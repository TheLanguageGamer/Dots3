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

var STACK_BASE = 21728, STACK_MAX = 5264608, DYNAMIC_BASE = 5264608, DYNAMICTOP_PTR = 21472;

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

var tempDoublePtr = 21712;

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

var debug_table_ii = [ "0", "__ZNKSt3__210__function6__funcIZN9ColorGameC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EE7__cloneEv", "__ZNKSt3__210__function6__funcIZN9ColorGameC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EE11target_typeEv", "__ZNKSt3__210__function6__funcIZN9ColorGameC1EvEUlvE_NS_9allocatorIS3_EEFvvEE7__cloneEv", "__ZNKSt3__210__function6__funcIZN9ColorGameC1EvEUlvE_NS_9allocatorIS3_EEFvvEE11target_typeEv", "__ZNKSt3__210__function6__funcIZN9ColorGameC1EvEUlvE0_NS_9allocatorIS3_EEFvvEE7__cloneEv", "__ZNKSt3__210__function6__funcIZN9ColorGameC1EvEUlvE0_NS_9allocatorIS3_EEFvvEE11target_typeEv", "__ZNKSt3__210__function6__funcIZN9ColorGameC1EvEUlRK7Vector2E0_NS_9allocatorIS6_EEFvS5_EE7__cloneEv", "__ZNKSt3__210__function6__funcIZN9ColorGameC1EvEUlRK7Vector2E0_NS_9allocatorIS6_EEFvS5_EE11target_typeEv", "__ZNKSt3__210__function6__funcIZN9ColorGameC1EvEUlvE1_NS_9allocatorIS3_EEFP9ComponentvEE7__cloneEv", "__ZNSt3__210__function6__funcIZN9ColorGameC1EvEUlvE1_NS_9allocatorIS3_EEFP9ComponentvEEclEv", "__ZNKSt3__210__function6__funcIZN9ColorGameC1EvEUlvE1_NS_9allocatorIS3_EEFP9ComponentvEE11target_typeEv", "__ZNKSt3__210__function6__funcIZN9ColorGameC1EvEUlP9ComponentjjjE_NS_9allocatorIS5_EEFvS4_jjjEE7__cloneEv", "__ZNKSt3__210__function6__funcIZN9ColorGameC1EvEUlP9ComponentjjjE_NS_9allocatorIS5_EEFvS4_jjjEE11target_typeEv", "__ZNKSt3__210__function6__funcIZN13ComponentGridC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEE10Vector2IntfNS_8functionIFP9ComponentvEEESE_NSA_IFvSC_jjjEEEEUlvE_NS5_ISH_EEFNS_10shared_ptrISB_EEvEE7__cloneEv", "__ZNKSt3__210__function6__funcIZN13ComponentGridC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEE10Vector2IntfNS_8functionIFP9ComponentvEEESE_NSA_IFvSC_jjjEEEEUlvE_NS5_ISH_EEFNS_10shared_ptrISB_EEvEE11target_typeEv", "__ZNKSt3__210__function6__funcIZN9ColorGame18initializeForLevelERK10ColorLevelEUlvE_NS_9allocatorIS6_EEFvvEE7__cloneEv", "__ZNKSt3__210__function6__funcIZN9ColorGame18initializeForLevelERK10ColorLevelEUlvE_NS_9allocatorIS6_EEFvvEE11target_typeEv", "__ZNKSt3__210__function6__funcIZN9ColorGame18initializeForLevelERK10ColorLevelEUlvE0_NS_9allocatorIS6_EEFvvEE7__cloneEv", "__ZNKSt3__210__function6__funcIZN9ColorGame18initializeForLevelERK10ColorLevelEUlvE0_NS_9allocatorIS6_EEFvvEE11target_typeEv", "__ZNKSt3__210__function6__funcIZN10TriviaGameC1EvEUlvE_NS_9allocatorIS3_EEFP9ComponentvEE7__cloneEv", "__ZNSt3__210__function6__funcIZN10TriviaGameC1EvEUlvE_NS_9allocatorIS3_EEFP9ComponentvEEclEv", "__ZNKSt3__210__function6__funcIZN10TriviaGameC1EvEUlvE_NS_9allocatorIS3_EEFP9ComponentvEE11target_typeEv", "__ZNKSt3__210__function6__funcIZN10TriviaGameC1EvEUlP9ComponentjjjE_NS_9allocatorIS5_EEFvS4_jjjEE7__cloneEv", "__ZNKSt3__210__function6__funcIZN10TriviaGameC1EvEUlP9ComponentjjjE_NS_9allocatorIS5_EEFvS4_jjjEE11target_typeEv", "__ZNKSt3__210__function6__funcIZN10TriviaGameC1EvEUlvE0_NS_9allocatorIS3_EEFvvEE7__cloneEv", "__ZNKSt3__210__function6__funcIZN10TriviaGameC1EvEUlvE0_NS_9allocatorIS3_EEFvvEE11target_typeEv", "__ZNKSt3__210__function6__funcIZN10TriviaGameC1EvEUlvE1_NS_9allocatorIS3_EEFvvEE7__cloneEv", "__ZNKSt3__210__function6__funcIZN10TriviaGameC1EvEUlvE1_NS_9allocatorIS3_EEFvvEE11target_typeEv", "__ZNKSt3__210__function6__funcIZN10TriviaGameC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EE7__cloneEv", "__ZNKSt3__210__function6__funcIZN10TriviaGameC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EE11target_typeEv", "__ZNKSt3__210__function6__funcIZN10TriviaGame10initializeEvEUlvE_NS_9allocatorIS3_EEFvvEE7__cloneEv", "__ZNKSt3__210__function6__funcIZN10TriviaGame10initializeEvEUlvE_NS_9allocatorIS3_EEFvvEE11target_typeEv", "__ZNKSt3__210__function6__funcIZN10TriviaGame10initializeEvEUlvE0_NS_9allocatorIS3_EEFvvEE7__cloneEv", "__ZNKSt3__210__function6__funcIZN10TriviaGame10initializeEvEUlvE0_NS_9allocatorIS3_EEFvvEE11target_typeEv", "__ZNKSt3__210__function6__funcIZN10LyricsGameC1EvEUlvE_NS_9allocatorIS3_EEFP9ComponentvEE7__cloneEv", "__ZNSt3__210__function6__funcIZN10LyricsGameC1EvEUlvE_NS_9allocatorIS3_EEFP9ComponentvEEclEv", "__ZNKSt3__210__function6__funcIZN10LyricsGameC1EvEUlvE_NS_9allocatorIS3_EEFP9ComponentvEE11target_typeEv", "__ZNKSt3__210__function6__funcIZN10LyricsGameC1EvEUlP9ComponentjjjE_NS_9allocatorIS5_EEFvS4_jjjEE7__cloneEv", "__ZNKSt3__210__function6__funcIZN10LyricsGameC1EvEUlP9ComponentjjjE_NS_9allocatorIS5_EEFvS4_jjjEE11target_typeEv", "__ZNKSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEE7__cloneEv", "__ZNKSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEE11target_typeEv", "___stdio_close", "__ZNKSt3__217bad_function_call4whatEv", "__ZNKSt11logic_error4whatEv", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0" ];

var debug_table_iii = [ "0", "__ZNKSt3__220__shared_ptr_pointerIP9ComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP24FilledRectangleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP24StrokeRectangleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP13TextComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__210__function6__funcIZN9ColorGameC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EE6targetERKSt9type_info", "__ZNKSt3__210__function6__funcIZN9ColorGameC1EvEUlvE_NS_9allocatorIS3_EEFvvEE6targetERKSt9type_info", "__ZNKSt3__210__function6__funcIZN9ColorGameC1EvEUlvE0_NS_9allocatorIS3_EEFvvEE6targetERKSt9type_info", "__ZNKSt3__210__function6__funcIZN9ColorGameC1EvEUlRK7Vector2E0_NS_9allocatorIS6_EEFvS5_EE6targetERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP15SpringAnimationNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__210__function6__funcIZN9ColorGameC1EvEUlvE1_NS_9allocatorIS3_EEFP9ComponentvEE6targetERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP21FilledCircleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__210__function6__funcIZN9ColorGameC1EvEUlP9ComponentjjjE_NS_9allocatorIS5_EEFvS4_jjjEE6targetERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP17FixedCapacityPoolNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__210__function6__funcIZN13ComponentGridC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEE10Vector2IntfNS_8functionIFP9ComponentvEEESE_NSA_IFvSC_jjjEEEEUlvE_NS5_ISH_EEFNS_10shared_ptrISB_EEvEE6targetERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP13ComponentCellNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP17PropertyAnimationNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP13ComponentGridNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__210__function6__funcIZN9ColorGame18initializeForLevelERK10ColorLevelEUlvE_NS_9allocatorIS6_EEFvvEE6targetERKSt9type_info", "__ZNKSt3__210__function6__funcIZN9ColorGame18initializeForLevelERK10ColorLevelEUlvE0_NS_9allocatorIS6_EEFvvEE6targetERKSt9type_info", "__ZNKSt3__210__function6__funcIZN10TriviaGameC1EvEUlvE_NS_9allocatorIS3_EEFP9ComponentvEE6targetERKSt9type_info", "__ZNKSt3__210__function6__funcIZN10TriviaGameC1EvEUlP9ComponentjjjE_NS_9allocatorIS5_EEFvS4_jjjEE6targetERKSt9type_info", "__ZNKSt3__210__function6__funcIZN10TriviaGameC1EvEUlvE0_NS_9allocatorIS3_EEFvvEE6targetERKSt9type_info", "__ZNKSt3__210__function6__funcIZN10TriviaGameC1EvEUlvE1_NS_9allocatorIS3_EEFvvEE6targetERKSt9type_info", "__ZNKSt3__210__function6__funcIZN10TriviaGameC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EE6targetERKSt9type_info", "__ZNKSt3__210__function6__funcIZN10TriviaGame10initializeEvEUlvE_NS_9allocatorIS3_EEFvvEE6targetERKSt9type_info", "__ZNKSt3__210__function6__funcIZN10TriviaGame10initializeEvEUlvE0_NS_9allocatorIS3_EEFvvEE6targetERKSt9type_info", "__ZNKSt3__210__function6__funcIZN10LyricsGameC1EvEUlvE_NS_9allocatorIS3_EEFP9ComponentvEE6targetERKSt9type_info", "__ZNKSt3__210__function6__funcIZN10LyricsGameC1EvEUlP9ComponentjjjE_NS_9allocatorIS5_EEFvS4_jjjEE6targetERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP9ColorGameNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP10TriviaGameNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__220__shared_ptr_pointerIP10LyricsGameNS_14default_deleteIS1_EENS_9allocatorIS1_EEE13__get_deleterERKSt9type_info", "__ZNKSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEE6targetERKSt9type_info", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0" ];

var debug_table_iiii = [ "0", "___stdio_write", "___stdio_seek", "___stdout_write", "_sn_write", "__ZNK10__cxxabiv117__class_type_info9can_catchEPKNS_16__shim_type_infoERPv", "0", "0" ];

var debug_table_v = [ "0", "__ZL25default_terminate_handlerv", "__Z9main_loopv", "__ZN10__cxxabiv112_GLOBAL__N_110construct_Ev" ];

var debug_table_vi = [ "0", "__ZNSt3__214__shared_countD2Ev", "__ZNSt3__220__shared_ptr_pointerIP9ComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP9ComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP9ComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP24FilledRectangleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP24FilledRectangleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP24FilledRectangleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP24StrokeRectangleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP24StrokeRectangleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP24StrokeRectangleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP13TextComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP13TextComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP13TextComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__210__function6__funcIZN9ColorGameC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EED2Ev", "__ZNSt3__210__function6__funcIZN9ColorGameC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EED0Ev", "__ZNSt3__210__function6__funcIZN9ColorGameC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EE7destroyEv", "__ZNSt3__210__function6__funcIZN9ColorGameC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EE18destroy_deallocateEv", "__ZNSt3__210__function6__baseIFvvEED2Ev", "__ZNSt3__210__function6__funcIZN9ColorGameC1EvEUlvE_NS_9allocatorIS3_EEFvvEED0Ev", "__ZNSt3__210__function6__funcIZN9ColorGameC1EvEUlvE_NS_9allocatorIS3_EEFvvEE7destroyEv", "__ZNSt3__210__function6__funcIZN9ColorGameC1EvEUlvE_NS_9allocatorIS3_EEFvvEE18destroy_deallocateEv", "__ZNSt3__210__function6__funcIZN9ColorGameC1EvEUlvE_NS_9allocatorIS3_EEFvvEEclEv", "__ZNSt3__210__function6__funcIZN9ColorGameC1EvEUlvE0_NS_9allocatorIS3_EEFvvEED0Ev", "__ZNSt3__210__function6__funcIZN9ColorGameC1EvEUlvE0_NS_9allocatorIS3_EEFvvEE7destroyEv", "__ZNSt3__210__function6__funcIZN9ColorGameC1EvEUlvE0_NS_9allocatorIS3_EEFvvEE18destroy_deallocateEv", "__ZNSt3__210__function6__funcIZN9ColorGameC1EvEUlvE0_NS_9allocatorIS3_EEFvvEEclEv", "__ZNSt3__210__function6__baseIFvRK7Vector2EED2Ev", "__ZNSt3__210__function6__funcIZN9ColorGameC1EvEUlRK7Vector2E0_NS_9allocatorIS6_EEFvS5_EED0Ev", "__ZNSt3__210__function6__funcIZN9ColorGameC1EvEUlRK7Vector2E0_NS_9allocatorIS6_EEFvS5_EE7destroyEv", "__ZNSt3__210__function6__funcIZN9ColorGameC1EvEUlRK7Vector2E0_NS_9allocatorIS6_EEFvS5_EE18destroy_deallocateEv", "__ZNSt3__220__shared_ptr_pointerIP15SpringAnimationNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP15SpringAnimationNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP15SpringAnimationNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__210__function6__baseIFP9ComponentvEED2Ev", "__ZNSt3__210__function6__funcIZN9ColorGameC1EvEUlvE1_NS_9allocatorIS3_EEFP9ComponentvEED0Ev", "__ZNSt3__210__function6__funcIZN9ColorGameC1EvEUlvE1_NS_9allocatorIS3_EEFP9ComponentvEE7destroyEv", "__ZNSt3__210__function6__funcIZN9ColorGameC1EvEUlvE1_NS_9allocatorIS3_EEFP9ComponentvEE18destroy_deallocateEv", "__ZNSt3__220__shared_ptr_pointerIP21FilledCircleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP21FilledCircleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP21FilledCircleComponentNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__210__function6__baseIFvP9ComponentjjjEED2Ev", "__ZNSt3__210__function6__funcIZN9ColorGameC1EvEUlP9ComponentjjjE_NS_9allocatorIS5_EEFvS4_jjjEED0Ev", "__ZNSt3__210__function6__funcIZN9ColorGameC1EvEUlP9ComponentjjjE_NS_9allocatorIS5_EEFvS4_jjjEE7destroyEv", "__ZNSt3__210__function6__funcIZN9ColorGameC1EvEUlP9ComponentjjjE_NS_9allocatorIS5_EEFvS4_jjjEE18destroy_deallocateEv", "__ZNSt3__220__shared_ptr_pointerIP17FixedCapacityPoolNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP17FixedCapacityPoolNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP17FixedCapacityPoolNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__210__function6__funcIZN13ComponentGridC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEE10Vector2IntfNS_8functionIFP9ComponentvEEESE_NSA_IFvSC_jjjEEEEUlvE_NS5_ISH_EEFNS_10shared_ptrISB_EEvEED2Ev", "__ZNSt3__210__function6__funcIZN13ComponentGridC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEE10Vector2IntfNS_8functionIFP9ComponentvEEESE_NSA_IFvSC_jjjEEEEUlvE_NS5_ISH_EEFNS_10shared_ptrISB_EEvEED0Ev", "__ZNSt3__210__function6__funcIZN13ComponentGridC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEE10Vector2IntfNS_8functionIFP9ComponentvEEESE_NSA_IFvSC_jjjEEEEUlvE_NS5_ISH_EEFNS_10shared_ptrISB_EEvEE7destroyEv", "__ZNSt3__210__function6__funcIZN13ComponentGridC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEE10Vector2IntfNS_8functionIFP9ComponentvEEESE_NSA_IFvSC_jjjEEEEUlvE_NS5_ISH_EEFNS_10shared_ptrISB_EEvEE18destroy_deallocateEv", "__ZNSt3__220__shared_ptr_pointerIP13ComponentCellNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP13ComponentCellNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP13ComponentCellNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP17PropertyAnimationNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP17PropertyAnimationNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP17PropertyAnimationNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP13ComponentGridNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP13ComponentGridNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP13ComponentGridNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__210__function6__funcIZN9ColorGame18initializeForLevelERK10ColorLevelEUlvE_NS_9allocatorIS6_EEFvvEED2Ev", "__ZNSt3__210__function6__funcIZN9ColorGame18initializeForLevelERK10ColorLevelEUlvE_NS_9allocatorIS6_EEFvvEED0Ev", "__ZNSt3__210__function6__funcIZN9ColorGame18initializeForLevelERK10ColorLevelEUlvE_NS_9allocatorIS6_EEFvvEE7destroyEv", "__ZNSt3__210__function6__funcIZN9ColorGame18initializeForLevelERK10ColorLevelEUlvE_NS_9allocatorIS6_EEFvvEE18destroy_deallocateEv", "__ZNSt3__210__function6__funcIZN9ColorGame18initializeForLevelERK10ColorLevelEUlvE_NS_9allocatorIS6_EEFvvEEclEv", "__ZNSt3__210__function6__funcIZN9ColorGame18initializeForLevelERK10ColorLevelEUlvE0_NS_9allocatorIS6_EEFvvEED2Ev", "__ZNSt3__210__function6__funcIZN9ColorGame18initializeForLevelERK10ColorLevelEUlvE0_NS_9allocatorIS6_EEFvvEED0Ev", "__ZNSt3__210__function6__funcIZN9ColorGame18initializeForLevelERK10ColorLevelEUlvE0_NS_9allocatorIS6_EEFvvEE7destroyEv", "__ZNSt3__210__function6__funcIZN9ColorGame18initializeForLevelERK10ColorLevelEUlvE0_NS_9allocatorIS6_EEFvvEE18destroy_deallocateEv", "__ZNSt3__210__function6__funcIZN9ColorGame18initializeForLevelERK10ColorLevelEUlvE0_NS_9allocatorIS6_EEFvvEEclEv", "__ZNSt3__210__function6__funcIZN10TriviaGameC1EvEUlvE_NS_9allocatorIS3_EEFP9ComponentvEED0Ev", "__ZNSt3__210__function6__funcIZN10TriviaGameC1EvEUlvE_NS_9allocatorIS3_EEFP9ComponentvEE7destroyEv", "__ZNSt3__210__function6__funcIZN10TriviaGameC1EvEUlvE_NS_9allocatorIS3_EEFP9ComponentvEE18destroy_deallocateEv", "__ZNSt3__210__function6__funcIZN10TriviaGameC1EvEUlP9ComponentjjjE_NS_9allocatorIS5_EEFvS4_jjjEED0Ev", "__ZNSt3__210__function6__funcIZN10TriviaGameC1EvEUlP9ComponentjjjE_NS_9allocatorIS5_EEFvS4_jjjEE7destroyEv", "__ZNSt3__210__function6__funcIZN10TriviaGameC1EvEUlP9ComponentjjjE_NS_9allocatorIS5_EEFvS4_jjjEE18destroy_deallocateEv", "__ZNSt3__210__function6__funcIZN10TriviaGameC1EvEUlvE0_NS_9allocatorIS3_EEFvvEED0Ev", "__ZNSt3__210__function6__funcIZN10TriviaGameC1EvEUlvE0_NS_9allocatorIS3_EEFvvEE7destroyEv", "__ZNSt3__210__function6__funcIZN10TriviaGameC1EvEUlvE0_NS_9allocatorIS3_EEFvvEE18destroy_deallocateEv", "__ZNSt3__210__function6__funcIZN10TriviaGameC1EvEUlvE0_NS_9allocatorIS3_EEFvvEEclEv", "__ZNSt3__210__function6__funcIZN10TriviaGameC1EvEUlvE1_NS_9allocatorIS3_EEFvvEED0Ev", "__ZNSt3__210__function6__funcIZN10TriviaGameC1EvEUlvE1_NS_9allocatorIS3_EEFvvEE7destroyEv", "__ZNSt3__210__function6__funcIZN10TriviaGameC1EvEUlvE1_NS_9allocatorIS3_EEFvvEE18destroy_deallocateEv", "__ZNSt3__210__function6__funcIZN10TriviaGameC1EvEUlvE1_NS_9allocatorIS3_EEFvvEEclEv", "__ZNSt3__210__function6__funcIZN10TriviaGameC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EED0Ev", "__ZNSt3__210__function6__funcIZN10TriviaGameC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EE7destroyEv", "__ZNSt3__210__function6__funcIZN10TriviaGameC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EE18destroy_deallocateEv", "__ZNSt3__210__function6__funcIZN10TriviaGame10initializeEvEUlvE_NS_9allocatorIS3_EEFvvEED2Ev", "__ZNSt3__210__function6__funcIZN10TriviaGame10initializeEvEUlvE_NS_9allocatorIS3_EEFvvEED0Ev", "__ZNSt3__210__function6__funcIZN10TriviaGame10initializeEvEUlvE_NS_9allocatorIS3_EEFvvEE7destroyEv", "__ZNSt3__210__function6__funcIZN10TriviaGame10initializeEvEUlvE_NS_9allocatorIS3_EEFvvEE18destroy_deallocateEv", "__ZNSt3__210__function6__funcIZN10TriviaGame10initializeEvEUlvE_NS_9allocatorIS3_EEFvvEEclEv", "__ZNSt3__210__function6__funcIZN10TriviaGame10initializeEvEUlvE0_NS_9allocatorIS3_EEFvvEED2Ev", "__ZNSt3__210__function6__funcIZN10TriviaGame10initializeEvEUlvE0_NS_9allocatorIS3_EEFvvEED0Ev", "__ZNSt3__210__function6__funcIZN10TriviaGame10initializeEvEUlvE0_NS_9allocatorIS3_EEFvvEE7destroyEv", "__ZNSt3__210__function6__funcIZN10TriviaGame10initializeEvEUlvE0_NS_9allocatorIS3_EEFvvEE18destroy_deallocateEv", "__ZNSt3__210__function6__funcIZN10TriviaGame10initializeEvEUlvE0_NS_9allocatorIS3_EEFvvEEclEv", "__ZNSt3__210__function6__funcIZN10LyricsGameC1EvEUlvE_NS_9allocatorIS3_EEFP9ComponentvEED0Ev", "__ZNSt3__210__function6__funcIZN10LyricsGameC1EvEUlvE_NS_9allocatorIS3_EEFP9ComponentvEE7destroyEv", "__ZNSt3__210__function6__funcIZN10LyricsGameC1EvEUlvE_NS_9allocatorIS3_EEFP9ComponentvEE18destroy_deallocateEv", "__ZNSt3__210__function6__funcIZN10LyricsGameC1EvEUlP9ComponentjjjE_NS_9allocatorIS5_EEFvS4_jjjEED0Ev", "__ZNSt3__210__function6__funcIZN10LyricsGameC1EvEUlP9ComponentjjjE_NS_9allocatorIS5_EEFvS4_jjjEE7destroyEv", "__ZNSt3__210__function6__funcIZN10LyricsGameC1EvEUlP9ComponentjjjE_NS_9allocatorIS5_EEFvS4_jjjEE18destroy_deallocateEv", "__ZNSt3__220__shared_ptr_pointerIP9ColorGameNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP9ColorGameNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP9ColorGameNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP10TriviaGameNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP10TriviaGameNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP10TriviaGameNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__220__shared_ptr_pointerIP10LyricsGameNS_14default_deleteIS1_EENS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_pointerIP10LyricsGameNS_14default_deleteIS1_EENS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_pointerIP10LyricsGameNS_14default_deleteIS1_EENS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEED0Ev", "__ZNSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEE7destroyEv", "__ZNSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEE18destroy_deallocateEv", "__ZNSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEEclEv", "__ZNSt3__217bad_function_callD2Ev", "__ZNSt3__217bad_function_callD0Ev", "__ZN10__cxxabiv116__shim_type_infoD2Ev", "__ZN10__cxxabiv117__class_type_infoD0Ev", "__ZNK10__cxxabiv116__shim_type_info5noop1Ev", "__ZNK10__cxxabiv116__shim_type_info5noop2Ev", "__ZN10__cxxabiv120__si_class_type_infoD0Ev", "__ZNSt11logic_errorD2Ev", "__ZNSt11logic_errorD0Ev", "__ZNSt12length_errorD0Ev", "__ZN10__cxxabiv121__vmi_class_type_infoD0Ev", "__ZN10__cxxabiv112_GLOBAL__N_19destruct_EPv", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0" ];

var debug_table_vidi = [ "0", "__ZN6Screen4loopEfRKNSt3__26vectorIbNS0_9allocatorIbEEEE" ];

var debug_table_vii = [ "0", "__ZN6Screen7onKeyUpEi", "__ZN6Screen9onKeyDownEi", "__ZNKSt3__210__function6__funcIZN9ColorGameC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EE7__cloneEPNS0_6__baseIS9_EE", "__ZNSt3__210__function6__funcIZN9ColorGameC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EEclES5_", "__ZNKSt3__210__function6__funcIZN9ColorGameC1EvEUlvE_NS_9allocatorIS3_EEFvvEE7__cloneEPNS0_6__baseIS6_EE", "__ZNKSt3__210__function6__funcIZN9ColorGameC1EvEUlvE0_NS_9allocatorIS3_EEFvvEE7__cloneEPNS0_6__baseIS6_EE", "__ZNKSt3__210__function6__funcIZN9ColorGameC1EvEUlRK7Vector2E0_NS_9allocatorIS6_EEFvS5_EE7__cloneEPNS0_6__baseIS9_EE", "__ZNSt3__210__function6__funcIZN9ColorGameC1EvEUlRK7Vector2E0_NS_9allocatorIS6_EEFvS5_EEclES5_", "__ZNKSt3__210__function6__funcIZN9ColorGameC1EvEUlvE1_NS_9allocatorIS3_EEFP9ComponentvEE7__cloneEPNS0_6__baseIS8_EE", "__ZNKSt3__210__function6__funcIZN9ColorGameC1EvEUlP9ComponentjjjE_NS_9allocatorIS5_EEFvS4_jjjEE7__cloneEPNS0_6__baseIS8_EE", "__ZNKSt3__210__function6__funcIZN13ComponentGridC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEE10Vector2IntfNS_8functionIFP9ComponentvEEESE_NSA_IFvSC_jjjEEEEUlvE_NS5_ISH_EEFNS_10shared_ptrISB_EEvEE7__cloneEPNS0_6__baseISL_EE", "__ZNSt3__210__function6__funcIZN13ComponentGridC1ERNS_6vectorI6EntityNS_9allocatorIS4_EEEE10Vector2IntfNS_8functionIFP9ComponentvEEESE_NSA_IFvSC_jjjEEEEUlvE_NS5_ISH_EEFNS_10shared_ptrISB_EEvEEclEv", "__ZNKSt3__210__function6__funcIZN9ColorGame18initializeForLevelERK10ColorLevelEUlvE_NS_9allocatorIS6_EEFvvEE7__cloneEPNS0_6__baseIS9_EE", "__ZNKSt3__210__function6__funcIZN9ColorGame18initializeForLevelERK10ColorLevelEUlvE0_NS_9allocatorIS6_EEFvvEE7__cloneEPNS0_6__baseIS9_EE", "__ZNKSt3__210__function6__funcIZN10TriviaGameC1EvEUlvE_NS_9allocatorIS3_EEFP9ComponentvEE7__cloneEPNS0_6__baseIS8_EE", "__ZNKSt3__210__function6__funcIZN10TriviaGameC1EvEUlP9ComponentjjjE_NS_9allocatorIS5_EEFvS4_jjjEE7__cloneEPNS0_6__baseIS8_EE", "__ZNKSt3__210__function6__funcIZN10TriviaGameC1EvEUlvE0_NS_9allocatorIS3_EEFvvEE7__cloneEPNS0_6__baseIS6_EE", "__ZNKSt3__210__function6__funcIZN10TriviaGameC1EvEUlvE1_NS_9allocatorIS3_EEFvvEE7__cloneEPNS0_6__baseIS6_EE", "__ZNKSt3__210__function6__funcIZN10TriviaGameC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EE7__cloneEPNS0_6__baseIS9_EE", "__ZNSt3__210__function6__funcIZN10TriviaGameC1EvEUlRK7Vector2E_NS_9allocatorIS6_EEFvS5_EEclES5_", "__ZNKSt3__210__function6__funcIZN10TriviaGame10initializeEvEUlvE_NS_9allocatorIS3_EEFvvEE7__cloneEPNS0_6__baseIS6_EE", "__ZNKSt3__210__function6__funcIZN10TriviaGame10initializeEvEUlvE0_NS_9allocatorIS3_EEFvvEE7__cloneEPNS0_6__baseIS6_EE", "__ZNKSt3__210__function6__funcIZN10LyricsGameC1EvEUlvE_NS_9allocatorIS3_EEFP9ComponentvEE7__cloneEPNS0_6__baseIS8_EE", "__ZNKSt3__210__function6__funcIZN10LyricsGameC1EvEUlP9ComponentjjjE_NS_9allocatorIS5_EEFvS4_jjjEE7__cloneEPNS0_6__baseIS8_EE", "__ZNKSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEE7__cloneEPNS0_6__baseIS5_EE", "0", "0", "0", "0", "0", "0" ];

var debug_table_viid = [ "0", "__ZN15SpringAnimation6onStepERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEEf", "__ZN8Movement6onStepERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEEf", "__ZN17PropertyAnimation6onStepERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEEf" ];

var debug_table_viii = [ "0", "__ZN9Component11setSizeModeERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEENS_8SizeModeE", "__ZN9Component8addChildERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEENS0_10shared_ptrIS_EE", "__ZN13TextComponent11setSizeModeERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEEN9Component8SizeModeE" ];

var debug_table_viiii = [ "0", "__ZN9Component8doLayoutERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN9Component16doLayoutEntitiesERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN24FilledRectangleComponent8doLayoutERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN24FilledRectangleComponent16doLayoutEntitiesERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN24StrokeRectangleComponent8doLayoutERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN24StrokeRectangleComponent16doLayoutEntitiesERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN13TextComponent8doLayoutERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN13TextComponent16doLayoutEntitiesERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN21FilledCircleComponent8doLayoutERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN21FilledCircleComponent16doLayoutEntitiesERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN18RectangleComponent8doLayoutERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZN18RectangleComponent16doLayoutEntitiesERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEERK7Vector2S9_", "__ZNK10__cxxabiv117__class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi", "__ZNK10__cxxabiv120__si_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi", "__ZNK10__cxxabiv121__vmi_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi" ];

var debug_table_viiiii = [ "0", "__ZNSt3__210__function6__funcIZN9ColorGameC1EvEUlP9ComponentjjjE_NS_9allocatorIS5_EEFvS4_jjjEEclEOS4_OjSB_SB_", "__ZNSt3__210__function6__funcIZN10TriviaGameC1EvEUlP9ComponentjjjE_NS_9allocatorIS5_EEFvS4_jjjEEclEOS4_OjSB_SB_", "__ZNSt3__210__function6__funcIZN10LyricsGameC1EvEUlP9ComponentjjjE_NS_9allocatorIS5_EEFvS4_jjjEEclEOS4_OjSB_SB_", "__ZNK10__cxxabiv117__class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib", "__ZNK10__cxxabiv120__si_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib", "__ZNK10__cxxabiv121__vmi_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib", "0" ];

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
 "x": _Engine_Rectangle,
 "y": _Engine_RoundedRectangle,
 "z": _Engine_StrokeEllipse,
 "A": _Engine_StrokeRectangle,
 "B": _SDL_GetTicks,
 "C": _SDL_Init,
 "D": _SDL_LockSurface,
 "E": _SDL_PollEvent,
 "F": _SDL_SetVideoMode,
 "G": __ZSt18uncaught_exceptionv,
 "H": ___cxa_allocate_exception,
 "I": ___cxa_begin_catch,
 "J": ___cxa_find_matching_catch,
 "K": ___cxa_free_exception,
 "L": ___cxa_throw,
 "M": ___gxx_personality_v0,
 "N": ___lock,
 "O": ___resumeException,
 "P": ___setErrNo,
 "Q": ___syscall140,
 "R": ___syscall146,
 "S": ___syscall221,
 "T": ___syscall3,
 "U": ___syscall5,
 "V": ___syscall54,
 "W": ___syscall6,
 "X": ___unlock,
 "Y": _abort,
 "Z": _emscripten_get_heap_size,
 "_": _emscripten_get_now,
 "$": _emscripten_memcpy_big,
 "aa": _emscripten_resize_heap,
 "ab": _emscripten_set_main_loop,
 "ac": _emscripten_set_main_loop_timing,
 "ad": _getCanvasHeight,
 "ae": _getCanvasWidth,
 "af": _pthread_getspecific,
 "ag": _pthread_key_create,
 "ah": _pthread_once,
 "ai": _pthread_setspecific,
 "aj": abortOnCannotGrowMemory,
 "ak": tempDoublePtr,
 "al": DYNAMICTOP_PTR
};

// EMSCRIPTEN_START_ASM


var asm = (/** @suppress {uselessCode} */ function(global,env,buffer) {
"use asm";var a=new global.Int8Array(buffer),b=new global.Int16Array(buffer),c=new global.Int32Array(buffer),d=new global.Uint8Array(buffer),e=new global.Uint16Array(buffer),f=new global.Float32Array(buffer),g=new global.Float64Array(buffer),h=env.ak|0,i=env.al|0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0.0,r=global.Math.floor,s=global.Math.abs,t=global.Math.sqrt,u=global.Math.exp,v=global.Math.ceil,w=global.Math.imul,x=global.Math.clz32,y=env.a,z=env.b,A=env.c,B=env.d,C=env.e,D=env.f,E=env.g,F=env.h,G=env.i,H=env.j,I=env.k,J=env.l,K=env.m,L=env.n,M=env.o,N=env.p,O=env.q,P=env.r,Q=env.s,R=env.t,S=env.u,T=env.v,U=env.w,V=env.x,W=env.y,X=env.z,Y=env.A,Z=env.B,_=env.C,$=env.D,aa=env.E,ba=env.F,ca=env.G,da=env.H,ea=env.I,fa=env.J,ga=env.K,ha=env.L,ia=env.M,ja=env.N,ka=env.O,la=env.P,ma=env.Q,na=env.R,oa=env.S,pa=env.T,qa=env.U,ra=env.V,sa=env.W,ta=env.X,ua=env.Y,va=env.Z,wa=env._,xa=env.$,ya=env.aa,za=env.ab,Aa=env.ac,Ba=env.ad,Ca=env.ae,Da=env.af,Ea=env.ag,Fa=env.ah,Ga=env.ai,Ha=env.aj,Ia=21728,Ja=5264608,Ka=0.0;
// EMSCRIPTEN_START_FUNCS
function Xa(a){a=a|0;var b=0;b=Ia;Ia=Ia+a|0;Ia=Ia+15&-16;if((Ia|0)>=(Ja|0))B(a|0);return b|0}function Ya(){return Ia|0}function Za(a){a=a|0;Ia=a}function _a(a,b){a=a|0;b=b|0;Ia=a;Ja=b}function $a(){return 6272}function ab(){return 6370}function bb(b){b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ba=0,ca=0,da=0,ea=0,fa=0,ga=0,ha=0,ia=0,ja=0,ka=0,la=0,ma=0,na=0,oa=0,pa=0,qa=0,ra=0,sa=0,ta=0,ua=0,va=0,wa=0,xa=0,ya=0,za=0,Aa=0,Ba=0,Ca=0,Da=0,Ea=0,Fa=0,Ga=0,Ha=0,Ka=0,La=0,Ma=0,Na=0,Oa=0,Pa=0,Qa=0,Ra=0,Sa=0,Ta=0,Ua=0,Va=0,Wa=0;d=Ia;Ia=Ia+3248|0;if((Ia|0)>=(Ja|0))B(3248);e=d;f=d+3228|0;g=d+3216|0;h=d+3204|0;i=d+3192|0;j=d+3180|0;k=d+3168|0;l=d+3156|0;m=d+3144|0;n=d+3132|0;o=d+3120|0;p=d+3108|0;q=d+3096|0;r=d+3084|0;s=d+3072|0;t=d+3060|0;u=d+3048|0;v=d+3036|0;w=d+3024|0;x=d+3012|0;y=d+3e3|0;z=d+2988|0;A=d+2976|0;C=d+2964|0;D=d+2952|0;E=d+2940|0;F=d+2928|0;G=d+2916|0;H=d+2904|0;I=d+2892|0;J=d+2880|0;K=d+2868|0;L=d+2856|0;M=d+2844|0;N=d+2832|0;O=d+2820|0;P=d+2808|0;Q=d+2796|0;R=d+2784|0;S=d+2772|0;T=d+2760|0;U=d+2748|0;V=d+2736|0;W=d+2724|0;X=d+2712|0;Y=d+2700|0;Z=d+2688|0;_=d+2676|0;$=d+2664|0;aa=d+2652|0;ba=d+2640|0;ca=d+2628|0;da=d+2616|0;ea=d+2604|0;fa=d+2592|0;ga=d+2580|0;ha=d+2568|0;ia=d+2556|0;ja=d+2544|0;ka=d+2532|0;la=d+2520|0;ma=d+2508|0;na=d+2496|0;oa=d+2484|0;pa=d+2472|0;qa=d+2460|0;ra=d+2448|0;sa=d+2436|0;ta=d+2424|0;ua=d+2412|0;va=d+2400|0;wa=d+2388|0;xa=d+2376|0;ya=d+2364|0;za=d+2352|0;Aa=d+2340|0;Ba=d+2328|0;Ca=d+2316|0;Da=d+2304|0;Ea=d+2292|0;Fa=d+2280|0;Ga=d+2268|0;Ha=d+2256|0;Ka=d+2244|0;La=d+2232|0;Ma=d+2220|0;Na=d+2208|0;Oa=d+2196|0;Pa=d+2184|0;Qa=d+2172|0;Ra=d+2160|0;c[f>>2]=0;c[f+4>>2]=0;c[f+8>>2]=0;Sa=ni(48)|0;c[f>>2]=Sa;c[f+8>>2]=-2147483600;c[f+4>>2]=40;Ta=Sa;Ua=6482;Va=Ta+40|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Sa+40>>0]=0;c[g>>2]=0;c[g+4>>2]=0;c[g+8>>2]=0;Sa=ni(32)|0;c[g>>2]=Sa;c[g+8>>2]=-2147483616;c[g+4>>2]=31;Ta=Sa;Ua=6523;Va=Ta+31|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Sa+31>>0]=0;c[e>>2]=0;wi(e+4|0,f);wi(e+16|0,g);Sa=e+32|0;c[Sa>>2]=1950;c[Sa+4>>2]=0;c[e+40>>2]=0;Sa=e+48|0;c[h>>2]=0;c[h+4>>2]=0;c[h+8>>2]=0;Wa=ni(64)|0;c[h>>2]=Wa;c[h+8>>2]=-2147483584;c[h+4>>2]=62;Ta=Wa;Ua=6555;Va=Ta+62|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+62>>0]=0;c[i>>2]=0;c[i+4>>2]=0;c[i+8>>2]=0;Wa=ni(32)|0;c[i>>2]=Wa;c[i+8>>2]=-2147483616;c[i+4>>2]=28;Ta=Wa;Ua=6618;Va=Ta+28|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+28>>0]=0;c[Sa>>2]=0;wi(e+52|0,h);wi(e+64|0,i);Sa=e+80|0;c[Sa>>2]=1963;c[Sa+4>>2]=0;c[e+88>>2]=0;Sa=e+96|0;c[j>>2]=0;c[j+4>>2]=0;c[j+8>>2]=0;Wa=ni(80)|0;c[j>>2]=Wa;c[j+8>>2]=-2147483568;c[j+4>>2]=69;Ta=Wa;Ua=6647;Va=Ta+69|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+69>>0]=0;c[k>>2]=0;c[k+4>>2]=0;c[k+8>>2]=0;Wa=ni(48)|0;c[k>>2]=Wa;c[k+8>>2]=-2147483600;c[k+4>>2]=47;Ta=Wa;Ua=6717;Va=Ta+47|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+47>>0]=0;c[Sa>>2]=0;wi(e+100|0,j);wi(e+112|0,k);Sa=e+128|0;c[Sa>>2]=1968;c[Sa+4>>2]=0;c[e+136>>2]=0;Sa=e+144|0;c[l>>2]=0;c[l+4>>2]=0;c[l+8>>2]=0;Wa=ni(64)|0;c[l>>2]=Wa;c[l+8>>2]=-2147483584;c[l+4>>2]=57;Ta=Wa;Ua=6765;Va=Ta+57|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+57>>0]=0;c[m>>2]=0;c[m+4>>2]=0;c[m+8>>2]=0;Wa=ni(80)|0;c[m>>2]=Wa;c[m+8>>2]=-2147483568;c[m+4>>2]=66;Ta=Wa;Ua=6823;Va=Ta+66|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+66>>0]=0;c[Sa>>2]=0;wi(e+148|0,l);wi(e+160|0,m);Sa=e+176|0;c[Sa>>2]=1954;c[Sa+4>>2]=0;c[e+184>>2]=0;Sa=e+192|0;c[n>>2]=0;c[n+4>>2]=0;c[n+8>>2]=0;Wa=ni(48)|0;c[n>>2]=Wa;c[n+8>>2]=-2147483600;c[n+4>>2]=41;Ta=Wa;Ua=6890;Va=Ta+41|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+41>>0]=0;c[o>>2]=0;c[o+4>>2]=0;c[o+8>>2]=0;Wa=ni(64)|0;c[o>>2]=Wa;c[o+8>>2]=-2147483584;c[o+4>>2]=53;Ta=Wa;Ua=6932;Va=Ta+53|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+53>>0]=0;c[Sa>>2]=0;wi(e+196|0,n);wi(e+208|0,o);Sa=e+224|0;c[Sa>>2]=1964;c[Sa+4>>2]=0;c[e+232>>2]=0;Sa=e+240|0;c[p>>2]=0;c[p+4>>2]=0;c[p+8>>2]=0;Wa=ni(80)|0;c[p>>2]=Wa;c[p+8>>2]=-2147483568;c[p+4>>2]=69;Ta=Wa;Ua=6986;Va=Ta+69|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+69>>0]=0;c[q>>2]=0;c[q+4>>2]=0;c[q+8>>2]=0;Wa=ni(64)|0;c[q>>2]=Wa;c[q+8>>2]=-2147483584;c[q+4>>2]=57;Ta=Wa;Ua=7056;Va=Ta+57|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+57>>0]=0;c[Sa>>2]=0;wi(e+244|0,p);wi(e+256|0,q);Sa=e+272|0;c[Sa>>2]=1920;c[Sa+4>>2]=0;c[e+280>>2]=0;Sa=e+288|0;c[r>>2]=0;c[r+4>>2]=0;c[r+8>>2]=0;Wa=ni(80)|0;c[r>>2]=Wa;c[r+8>>2]=-2147483568;c[r+4>>2]=70;Ta=Wa;Ua=7114;Va=Ta+70|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+70>>0]=0;c[s>>2]=0;c[s+4>>2]=0;c[s+8>>2]=0;Wa=ni(64)|0;c[s>>2]=Wa;c[s+8>>2]=-2147483584;c[s+4>>2]=58;Ta=Wa;Ua=7185;Va=Ta+58|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+58>>0]=0;c[Sa>>2]=0;wi(e+292|0,r);wi(e+304|0,s);Sa=e+320|0;c[Sa>>2]=1918;c[Sa+4>>2]=0;c[e+328>>2]=0;Sa=e+336|0;c[t>>2]=0;c[t+4>>2]=0;c[t+8>>2]=0;Wa=ni(64)|0;c[t>>2]=Wa;c[t+8>>2]=-2147483584;c[t+4>>2]=55;Ta=Wa;Ua=7244;Va=Ta+55|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+55>>0]=0;c[u>>2]=0;c[u+4>>2]=0;c[u+8>>2]=0;Wa=ni(48)|0;c[u>>2]=Wa;c[u+8>>2]=-2147483600;c[u+4>>2]=46;Ta=Wa;Ua=7300;Va=Ta+46|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+46>>0]=0;c[Sa>>2]=0;wi(e+340|0,t);wi(e+352|0,u);Sa=e+368|0;c[Sa>>2]=1944;c[Sa+4>>2]=0;c[e+376>>2]=0;Sa=e+384|0;c[v>>2]=0;c[v+4>>2]=0;c[v+8>>2]=0;Wa=ni(96)|0;c[v>>2]=Wa;c[v+8>>2]=-2147483552;c[v+4>>2]=92;Ta=Wa;Ua=7347;Va=Ta+92|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+92>>0]=0;c[w>>2]=0;c[w+4>>2]=0;c[w+8>>2]=0;Wa=ni(64)|0;c[w>>2]=Wa;c[w+8>>2]=-2147483584;c[w+4>>2]=53;Ta=Wa;Ua=7440;Va=Ta+53|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+53>>0]=0;c[Sa>>2]=0;wi(e+388|0,v);wi(e+400|0,w);Sa=e+416|0;c[Sa>>2]=1939;c[Sa+4>>2]=0;c[e+424>>2]=0;Sa=e+432|0;c[x>>2]=0;c[x+4>>2]=0;c[x+8>>2]=0;Wa=ni(80)|0;c[x>>2]=Wa;c[x+8>>2]=-2147483568;c[x+4>>2]=71;Ta=Wa;Ua=7494;Va=Ta+71|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+71>>0]=0;c[y>>2]=0;c[y+4>>2]=0;c[y+8>>2]=0;Wa=ni(64)|0;c[y>>2]=Wa;c[y+8>>2]=-2147483584;c[y+4>>2]=61;Ta=Wa;Ua=7566;Va=Ta+61|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+61>>0]=0;c[Sa>>2]=0;wi(e+436|0,x);wi(e+448|0,y);Sa=e+464|0;c[Sa>>2]=1876;c[Sa+4>>2]=0;c[e+472>>2]=0;Sa=e+480|0;c[z>>2]=0;c[z+4>>2]=0;c[z+8>>2]=0;Wa=ni(64)|0;c[z>>2]=Wa;c[z+8>>2]=-2147483584;c[z+4>>2]=54;Ta=Wa;Ua=7628;Va=Ta+54|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+54>>0]=0;c[A>>2]=0;c[A+4>>2]=0;c[A+8>>2]=0;Wa=ni(64)|0;c[A>>2]=Wa;c[A+8>>2]=-2147483584;c[A+4>>2]=58;Ta=Wa;Ua=7683;Va=Ta+58|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+58>>0]=0;c[Sa>>2]=0;wi(e+484|0,z);wi(e+496|0,A);Sa=e+512|0;c[Sa>>2]=1947;c[Sa+4>>2]=0;c[e+520>>2]=0;Sa=e+528|0;c[C>>2]=0;c[C+4>>2]=0;c[C+8>>2]=0;Wa=ni(64)|0;c[C>>2]=Wa;c[C+8>>2]=-2147483584;c[C+4>>2]=53;Ta=Wa;Ua=7742;Va=Ta+53|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+53>>0]=0;c[D>>2]=0;c[D+4>>2]=0;c[D+8>>2]=0;Wa=ni(64)|0;c[D>>2]=Wa;c[D+8>>2]=-2147483584;c[D+4>>2]=60;Ta=Wa;Ua=7796;Va=Ta+60|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+60>>0]=0;c[Sa>>2]=0;wi(e+532|0,C);wi(e+544|0,D);Sa=e+560|0;c[Sa>>2]=1962;c[Sa+4>>2]=0;c[e+568>>2]=0;Sa=e+576|0;c[E>>2]=0;c[E+4>>2]=0;c[E+8>>2]=0;Wa=ni(64)|0;c[E>>2]=Wa;c[E+8>>2]=-2147483584;c[E+4>>2]=52;Ta=Wa;Ua=7857;Va=Ta+52|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+52>>0]=0;c[F>>2]=0;c[F+4>>2]=0;c[F+8>>2]=0;Wa=ni(64)|0;c[F>>2]=Wa;c[F+8>>2]=-2147483584;c[F+4>>2]=58;Ta=Wa;Ua=7910;Va=Ta+58|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+58>>0]=0;c[Sa>>2]=0;wi(e+580|0,E);wi(e+592|0,F);Sa=e+608|0;c[Sa>>2]=1929;c[Sa+4>>2]=0;c[e+616>>2]=0;Sa=e+624|0;c[G>>2]=0;c[G+4>>2]=0;c[G+8>>2]=0;Wa=ni(48)|0;c[G>>2]=Wa;c[G+8>>2]=-2147483600;c[G+4>>2]=41;Ta=Wa;Ua=7969;Va=Ta+41|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+41>>0]=0;c[H>>2]=0;c[H+4>>2]=0;c[H+8>>2]=0;Wa=ni(64)|0;c[H>>2]=Wa;c[H+8>>2]=-2147483584;c[H+4>>2]=50;Ta=Wa;Ua=8011;Va=Ta+50|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+50>>0]=0;c[Sa>>2]=0;wi(e+628|0,G);wi(e+640|0,H);Sa=e+656|0;c[Sa>>2]=1973;c[Sa+4>>2]=0;c[e+664>>2]=0;Sa=e+672|0;c[I>>2]=0;c[I+4>>2]=0;c[I+8>>2]=0;Wa=ni(48)|0;c[I>>2]=Wa;c[I+8>>2]=-2147483600;c[I+4>>2]=41;Ta=Wa;Ua=7969;Va=Ta+41|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+41>>0]=0;c[J>>2]=0;c[J+4>>2]=0;c[J+8>>2]=0;Wa=ni(64)|0;c[J>>2]=Wa;c[J+8>>2]=-2147483584;c[J+4>>2]=51;Ta=Wa;Ua=8062;Va=Ta+51|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+51>>0]=0;c[Sa>>2]=0;wi(e+676|0,I);wi(e+688|0,J);Sa=e+704|0;c[Sa>>2]=800;c[Sa+4>>2]=0;c[e+712>>2]=0;Sa=e+720|0;c[K>>2]=0;c[K+4>>2]=0;c[K+8>>2]=0;Wa=ni(48)|0;c[K>>2]=Wa;c[K+8>>2]=-2147483600;c[K+4>>2]=38;Ta=Wa;Ua=8114;Va=Ta+38|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+38>>0]=0;c[L>>2]=0;c[L+4>>2]=0;c[L+8>>2]=0;Wa=ni(64)|0;c[L>>2]=Wa;c[L+8>>2]=-2147483584;c[L+4>>2]=56;Ta=Wa;Ua=8153;Va=Ta+56|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+56>>0]=0;c[Sa>>2]=0;wi(e+724|0,K);wi(e+736|0,L);Sa=e+752|0;c[Sa>>2]=1126;c[Sa+4>>2]=0;c[e+760>>2]=0;Sa=e+768|0;c[M>>2]=0;c[M+4>>2]=0;c[M+8>>2]=0;Wa=ni(48)|0;c[M>>2]=Wa;c[M+8>>2]=-2147483600;c[M+4>>2]=42;Ta=Wa;Ua=8210;Va=Ta+42|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+42>>0]=0;c[N>>2]=0;c[N+4>>2]=0;c[N+8>>2]=0;Wa=ni(80)|0;c[N>>2]=Wa;c[N+8>>2]=-2147483568;c[N+4>>2]=65;Ta=Wa;Ua=8253;Va=Ta+65|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+65>>0]=0;c[Sa>>2]=0;wi(e+772|0,M);wi(e+784|0,N);Sa=e+800|0;c[Sa>>2]=1206;c[Sa+4>>2]=0;c[e+808>>2]=0;Sa=e+816|0;c[O>>2]=0;c[O+4>>2]=0;c[O+8>>2]=0;Wa=ni(48)|0;c[O>>2]=Wa;c[O+8>>2]=-2147483600;c[O+4>>2]=40;Ta=Wa;Ua=8319;Va=Ta+40|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+40>>0]=0;c[P>>2]=0;c[P+4>>2]=0;c[P+8>>2]=0;Wa=ni(48)|0;c[P>>2]=Wa;c[P+8>>2]=-2147483600;c[P+4>>2]=47;Ta=Wa;Ua=8360;Va=Ta+47|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+47>>0]=0;c[Sa>>2]=0;wi(e+820|0,O);wi(e+832|0,P);Sa=e+848|0;c[Sa>>2]=1271;c[Sa+4>>2]=0;c[e+856>>2]=0;Sa=e+864|0;c[Q>>2]=0;c[Q+4>>2]=0;c[Q+8>>2]=0;Wa=ni(48)|0;c[Q>>2]=Wa;c[Q+8>>2]=-2147483600;c[Q+4>>2]=42;Ta=Wa;Ua=8408;Va=Ta+42|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+42>>0]=0;c[R>>2]=0;c[R+4>>2]=0;c[R+8>>2]=0;Wa=ni(64)|0;c[R>>2]=Wa;c[R+8>>2]=-2147483584;c[R+4>>2]=51;Ta=Wa;Ua=8451;Va=Ta+51|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+51>>0]=0;c[Sa>>2]=0;wi(e+868|0,Q);wi(e+880|0,R);Sa=e+896|0;c[Sa>>2]=1325;c[Sa+4>>2]=0;c[e+904>>2]=0;Sa=e+912|0;c[S>>2]=0;c[S+4>>2]=0;c[S+8>>2]=0;Wa=ni(64)|0;c[S>>2]=Wa;c[S+8>>2]=-2147483584;c[S+4>>2]=62;Ta=Wa;Ua=8503;Va=Ta+62|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+62>>0]=0;c[T>>2]=0;c[T+4>>2]=0;c[T+8>>2]=0;Wa=ni(48)|0;c[T>>2]=Wa;c[T+8>>2]=-2147483600;c[T+4>>2]=44;Ta=Wa;Ua=8566;Va=Ta+44|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+44>>0]=0;c[Sa>>2]=0;wi(e+916|0,S);wi(e+928|0,T);Sa=e+944|0;c[Sa>>2]=1356;c[Sa+4>>2]=0;c[e+952>>2]=0;Sa=e+960|0;c[U>>2]=0;c[U+4>>2]=0;c[U+8>>2]=0;Wa=ni(48)|0;c[U>>2]=Wa;c[U+8>>2]=-2147483600;c[U+4>>2]=42;Ta=Wa;Ua=8611;Va=Ta+42|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+42>>0]=0;c[V>>2]=0;c[V+4>>2]=0;c[V+8>>2]=0;Wa=ni(48)|0;c[V>>2]=Wa;c[V+8>>2]=-2147483600;c[V+4>>2]=42;Ta=Wa;Ua=8654;Va=Ta+42|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+42>>0]=0;c[Sa>>2]=0;wi(e+964|0,U);wi(e+976|0,V);Sa=e+992|0;c[Sa>>2]=1368;c[Sa+4>>2]=0;c[e+1e3>>2]=0;Sa=e+1008|0;c[W>>2]=0;c[W+4>>2]=0;c[W+8>>2]=0;Wa=ni(48)|0;c[W>>2]=Wa;c[W+8>>2]=-2147483600;c[W+4>>2]=37;Ta=Wa;Ua=8697;Va=Ta+37|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+37>>0]=0;c[X>>2]=0;c[X+4>>2]=0;c[X+8>>2]=0;Wa=ni(48)|0;c[X>>2]=Wa;c[X+8>>2]=-2147483600;c[X+4>>2]=47;Ta=Wa;Ua=8735;Va=Ta+47|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+47>>0]=0;c[Sa>>2]=0;wi(e+1012|0,W);wi(e+1024|0,X);Sa=e+1040|0;c[Sa>>2]=1415;c[Sa+4>>2]=0;c[e+1048>>2]=0;Sa=e+1056|0;c[Y>>2]=0;c[Y+4>>2]=0;c[Y+8>>2]=0;Wa=ni(48)|0;c[Y>>2]=Wa;c[Y+8>>2]=-2147483600;c[Y+4>>2]=38;Ta=Wa;Ua=8783;Va=Ta+38|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+38>>0]=0;c[Z>>2]=0;c[Z+4>>2]=0;c[Z+8>>2]=0;Wa=ni(32)|0;c[Z>>2]=Wa;c[Z+8>>2]=-2147483616;c[Z+4>>2]=28;Ta=Wa;Ua=8822;Va=Ta+28|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+28>>0]=0;c[Sa>>2]=0;wi(e+1060|0,Y);wi(e+1072|0,Z);Sa=e+1088|0;c[Sa>>2]=1492;c[Sa+4>>2]=0;c[e+1096>>2]=0;Sa=e+1104|0;c[_>>2]=0;c[_+4>>2]=0;c[_+8>>2]=0;Wa=ni(48)|0;c[_>>2]=Wa;c[_+8>>2]=-2147483600;c[_+4>>2]=38;Ta=Wa;Ua=8783;Va=Ta+38|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+38>>0]=0;c[$>>2]=0;c[$+4>>2]=0;c[$+8>>2]=0;Wa=ni(80)|0;c[$>>2]=Wa;c[$+8>>2]=-2147483568;c[$+4>>2]=76;Ta=Wa;Ua=8851;Va=Ta+76|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+76>>0]=0;c[Sa>>2]=0;wi(e+1108|0,_);wi(e+1120|0,$);Sa=e+1136|0;c[Sa>>2]=1494;c[Sa+4>>2]=0;c[e+1144>>2]=0;Sa=e+1152|0;c[aa>>2]=0;c[aa+4>>2]=0;c[aa+8>>2]=0;Wa=ni(64)|0;c[aa>>2]=Wa;c[aa+8>>2]=-2147483584;c[aa+4>>2]=50;Ta=Wa;Ua=8928;Va=Ta+50|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+50>>0]=0;c[ba>>2]=0;c[ba+4>>2]=0;c[ba+8>>2]=0;Wa=ni(48)|0;c[ba>>2]=Wa;c[ba+8>>2]=-2147483600;c[ba+4>>2]=46;Ta=Wa;Ua=8979;Va=Ta+46|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+46>>0]=0;c[Sa>>2]=0;wi(e+1156|0,aa);wi(e+1168|0,ba);Sa=e+1184|0;c[Sa>>2]=1494;c[Sa+4>>2]=0;c[e+1192>>2]=0;Sa=e+1200|0;c[ca>>2]=0;c[ca+4>>2]=0;c[ca+8>>2]=0;Wa=ni(64)|0;c[ca>>2]=Wa;c[ca+8>>2]=-2147483584;c[ca+4>>2]=48;Ta=Wa;Ua=9026;Va=Ta+48|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+48>>0]=0;c[da>>2]=0;c[da+4>>2]=0;c[da+8>>2]=0;Wa=ni(80)|0;c[da>>2]=Wa;c[da+8>>2]=-2147483568;c[da+4>>2]=69;Ta=Wa;Ua=9075;Va=Ta+69|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+69>>0]=0;c[Sa>>2]=0;wi(e+1204|0,ca);wi(e+1216|0,da);Sa=e+1232|0;c[Sa>>2]=1517;c[Sa+4>>2]=0;c[e+1240>>2]=0;Sa=e+1248|0;c[ea>>2]=0;c[ea+4>>2]=0;c[ea+8>>2]=0;Wa=ni(48)|0;c[ea>>2]=Wa;c[ea+8>>2]=-2147483600;c[ea+4>>2]=42;Ta=Wa;Ua=8408;Va=Ta+42|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+42>>0]=0;c[fa>>2]=0;c[fa+4>>2]=0;c[fa+8>>2]=0;Wa=ni(48)|0;c[fa>>2]=Wa;c[fa+8>>2]=-2147483600;c[fa+4>>2]=42;Ta=Wa;Ua=9145;Va=Ta+42|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+42>>0]=0;c[Sa>>2]=0;wi(e+1252|0,ea);wi(e+1264|0,fa);Sa=e+1280|0;c[Sa>>2]=1521;c[Sa+4>>2]=0;c[e+1288>>2]=0;Sa=e+1296|0;c[ga>>2]=0;c[ga+4>>2]=0;c[ga+8>>2]=0;Wa=ni(48)|0;c[ga>>2]=Wa;c[ga+8>>2]=-2147483600;c[ga+4>>2]=41;Ta=Wa;Ua=9188;Va=Ta+41|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+41>>0]=0;c[ha>>2]=0;c[ha+4>>2]=0;c[ha+8>>2]=0;Wa=ni(48)|0;c[ha>>2]=Wa;c[ha+8>>2]=-2147483600;c[ha+4>>2]=46;Ta=Wa;Ua=9230;Va=Ta+46|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+46>>0]=0;c[Sa>>2]=0;wi(e+1300|0,ga);wi(e+1312|0,ha);Sa=e+1328|0;c[Sa>>2]=1595;c[Sa+4>>2]=0;c[e+1336>>2]=0;Sa=e+1344|0;c[ia>>2]=0;c[ia+4>>2]=0;c[ia+8>>2]=0;Wa=ni(48)|0;c[ia>>2]=Wa;c[ia+8>>2]=-2147483600;c[ia+4>>2]=43;Ta=Wa;Ua=9277;Va=Ta+43|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+43>>0]=0;c[ja>>2]=0;c[ja+4>>2]=0;c[ja+8>>2]=0;Wa=ni(48)|0;c[ja>>2]=Wa;c[ja+8>>2]=-2147483600;c[ja+4>>2]=40;Ta=Wa;Ua=9321;Va=Ta+40|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+40>>0]=0;c[Sa>>2]=0;wi(e+1348|0,ia);wi(e+1360|0,ja);Sa=e+1376|0;c[Sa>>2]=1626;c[Sa+4>>2]=0;c[e+1384>>2]=0;Sa=e+1392|0;c[ka>>2]=0;c[ka+4>>2]=0;c[ka+8>>2]=0;Wa=ni(80)|0;c[ka>>2]=Wa;c[ka+8>>2]=-2147483568;c[ka+4>>2]=72;Ta=Wa;Ua=9362;Va=Ta+72|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+72>>0]=0;c[la>>2]=0;c[la+4>>2]=0;c[la+8>>2]=0;Wa=ni(80)|0;c[la>>2]=Wa;c[la+8>>2]=-2147483568;c[la+4>>2]=71;Ta=Wa;Ua=9435;Va=Ta+71|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+71>>0]=0;c[Sa>>2]=0;wi(e+1396|0,ka);wi(e+1408|0,la);Sa=e+1424|0;c[Sa>>2]=1789;c[Sa+4>>2]=0;c[e+1432>>2]=0;Sa=e+1440|0;c[ma>>2]=0;c[ma+4>>2]=0;c[ma+8>>2]=0;Wa=ni(64)|0;c[ma>>2]=Wa;c[ma+8>>2]=-2147483584;c[ma+4>>2]=48;Ta=Wa;Ua=9507;Va=Ta+48|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+48>>0]=0;c[na>>2]=0;c[na+4>>2]=0;c[na+8>>2]=0;Wa=ni(64)|0;c[na>>2]=Wa;c[na+8>>2]=-2147483584;c[na+4>>2]=62;Ta=Wa;Ua=9556;Va=Ta+62|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+62>>0]=0;c[Sa>>2]=0;wi(e+1444|0,ma);wi(e+1456|0,na);Sa=e+1472|0;c[Sa>>2]=1066;c[Sa+4>>2]=0;c[e+1480>>2]=0;Sa=e+1488|0;c[oa>>2]=0;c[oa+4>>2]=0;c[oa+8>>2]=0;Wa=ni(64)|0;c[oa>>2]=Wa;c[oa+8>>2]=-2147483584;c[oa+4>>2]=48;Ta=Wa;Ua=9507;Va=Ta+48|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+48>>0]=0;c[pa>>2]=0;c[pa+4>>2]=0;c[pa+8>>2]=0;Wa=ni(64)|0;c[pa>>2]=Wa;c[pa+8>>2]=-2147483584;c[pa+4>>2]=62;Ta=Wa;Ua=9556;Va=Ta+62|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+62>>0]=0;c[Sa>>2]=0;wi(e+1492|0,oa);wi(e+1504|0,pa);Sa=e+1520|0;c[Sa>>2]=1066;c[Sa+4>>2]=0;c[e+1528>>2]=0;Sa=e+1536|0;c[qa>>2]=0;c[qa+4>>2]=0;c[qa+8>>2]=0;Wa=ni(64)|0;c[qa>>2]=Wa;c[qa+8>>2]=-2147483584;c[qa+4>>2]=63;Ta=Wa;Ua=9619;Va=Ta+63|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+63>>0]=0;c[ra>>2]=0;c[ra+4>>2]=0;c[ra+8>>2]=0;Wa=ni(96)|0;c[ra>>2]=Wa;c[ra+8>>2]=-2147483552;c[ra+4>>2]=94;Ta=Wa;Ua=9683;Va=Ta+94|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+94>>0]=0;c[Sa>>2]=0;wi(e+1540|0,qa);wi(e+1552|0,ra);Sa=e+1568|0;c[Sa>>2]=1215;c[Sa+4>>2]=0;c[e+1576>>2]=0;Sa=e+1584|0;c[sa>>2]=0;c[sa+4>>2]=0;c[sa+8>>2]=0;Wa=ni(64)|0;c[sa>>2]=Wa;c[sa+8>>2]=-2147483584;c[sa+4>>2]=63;Ta=Wa;Ua=9778;Va=Ta+63|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+63>>0]=0;c[ta>>2]=0;c[ta+4>>2]=0;c[ta+8>>2]=0;Wa=ni(80)|0;c[ta>>2]=Wa;c[ta+8>>2]=-2147483568;c[ta+4>>2]=67;Ta=Wa;Ua=9842;Va=Ta+67|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+67>>0]=0;c[Sa>>2]=0;wi(e+1588|0,sa);wi(e+1600|0,ta);Sa=e+1616|0;c[Sa>>2]=1348;c[Sa+4>>2]=0;c[e+1624>>2]=0;Sa=e+1632|0;c[ua>>2]=0;c[ua+4>>2]=0;c[ua+8>>2]=0;Wa=ni(48)|0;c[ua>>2]=Wa;c[ua+8>>2]=-2147483600;c[ua+4>>2]=36;Ta=Wa;Ua=9910;Va=Ta+36|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+36>>0]=0;c[va>>2]=0;c[va+4>>2]=0;c[va+8>>2]=0;Wa=ni(48)|0;c[va>>2]=Wa;c[va+8>>2]=-2147483600;c[va+4>>2]=33;Ta=Wa;Ua=9947;Va=Ta+33|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+33>>0]=0;c[Sa>>2]=0;wi(e+1636|0,ua);wi(e+1648|0,va);Sa=e+1664|0;c[Sa>>2]=1602;c[Sa+4>>2]=0;c[e+1672>>2]=0;Sa=e+1680|0;c[wa>>2]=0;c[wa+4>>2]=0;c[wa+8>>2]=0;Wa=ni(48)|0;c[wa>>2]=Wa;c[wa+8>>2]=-2147483600;c[wa+4>>2]=44;Ta=Wa;Ua=9981;Va=Ta+44|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+44>>0]=0;c[xa>>2]=0;c[xa+4>>2]=0;c[xa+8>>2]=0;Wa=ni(64)|0;c[xa>>2]=Wa;c[xa+8>>2]=-2147483584;c[xa+4>>2]=55;Ta=Wa;Ua=10026;Va=Ta+55|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+55>>0]=0;c[Sa>>2]=0;wi(e+1684|0,wa);wi(e+1696|0,xa);Sa=e+1712|0;c[Sa>>2]=1605;c[Sa+4>>2]=0;c[e+1720>>2]=0;Sa=e+1728|0;c[ya>>2]=0;c[ya+4>>2]=0;c[ya+8>>2]=0;Wa=ni(64)|0;c[ya>>2]=Wa;c[ya+8>>2]=-2147483584;c[ya+4>>2]=48;Ta=Wa;Ua=10082;Va=Ta+48|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+48>>0]=0;c[za>>2]=0;c[za+4>>2]=0;c[za+8>>2]=0;Wa=ni(80)|0;c[za>>2]=Wa;c[za+8>>2]=-2147483568;c[za+4>>2]=65;Ta=Wa;Ua=10131;Va=Ta+65|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+65>>0]=0;c[Sa>>2]=0;wi(e+1732|0,ya);wi(e+1744|0,za);Sa=e+1760|0;c[Sa>>2]=1815;c[Sa+4>>2]=0;c[e+1768>>2]=0;Sa=e+1776|0;c[Aa>>2]=0;c[Aa+4>>2]=0;c[Aa+8>>2]=0;Wa=ni(48)|0;c[Aa>>2]=Wa;c[Aa+8>>2]=-2147483600;c[Aa+4>>2]=45;Ta=Wa;Ua=10197;Va=Ta+45|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+45>>0]=0;c[Ba>>2]=0;c[Ba+4>>2]=0;c[Ba+8>>2]=0;Wa=ni(48)|0;c[Ba>>2]=Wa;c[Ba+8>>2]=-2147483600;c[Ba+4>>2]=42;Ta=Wa;Ua=10243;Va=Ta+42|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+42>>0]=0;c[Sa>>2]=0;wi(e+1780|0,Aa);wi(e+1792|0,Ba);Sa=e+1808|0;c[Sa>>2]=1989;c[Sa+4>>2]=0;c[e+1816>>2]=0;Sa=e+1824|0;c[Ca>>2]=0;c[Ca+4>>2]=0;c[Ca+8>>2]=0;Wa=ni(48)|0;c[Ca>>2]=Wa;c[Ca+8>>2]=-2147483600;c[Ca+4>>2]=38;Ta=Wa;Ua=10286;Va=Ta+38|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+38>>0]=0;c[Da>>2]=0;c[Da+4>>2]=0;c[Da+8>>2]=0;Wa=ni(48)|0;c[Da>>2]=Wa;c[Da+8>>2]=-2147483600;c[Da+4>>2]=39;Ta=Wa;Ua=10325;Va=Ta+39|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+39>>0]=0;c[Sa>>2]=0;wi(e+1828|0,Ca);wi(e+1840|0,Da);Sa=e+1856|0;c[Sa>>2]=570;c[Sa+4>>2]=0;c[e+1864>>2]=0;Sa=e+1872|0;c[Ea>>2]=0;c[Ea+4>>2]=0;c[Ea+8>>2]=0;Wa=ni(48)|0;c[Ea>>2]=Wa;c[Ea+8>>2]=-2147483600;c[Ea+4>>2]=38;Ta=Wa;Ua=10286;Va=Ta+38|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+38>>0]=0;c[Fa>>2]=0;c[Fa+4>>2]=0;c[Fa+8>>2]=0;Wa=ni(48)|0;c[Fa>>2]=Wa;c[Fa+8>>2]=-2147483600;c[Fa+4>>2]=39;Ta=Wa;Ua=10325;Va=Ta+39|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+39>>0]=0;c[Sa>>2]=0;wi(e+1876|0,Ea);wi(e+1888|0,Fa);Sa=e+1904|0;c[Sa>>2]=570;c[Sa+4>>2]=0;c[e+1912>>2]=0;Sa=e+1920|0;c[Ga>>2]=0;c[Ga+4>>2]=0;c[Ga+8>>2]=0;Wa=ni(48)|0;c[Ga>>2]=Wa;c[Ga+8>>2]=-2147483600;c[Ga+4>>2]=44;Ta=Wa;Ua=10365;Va=Ta+44|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+44>>0]=0;c[Ha>>2]=0;c[Ha+4>>2]=0;c[Ha+8>>2]=0;Wa=ni(80)|0;c[Ha>>2]=Wa;c[Ha+8>>2]=-2147483568;c[Ha+4>>2]=69;Ta=Wa;Ua=10410;Va=Ta+69|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+69>>0]=0;c[Sa>>2]=0;wi(e+1924|0,Ga);wi(e+1936|0,Ha);Sa=e+1952|0;c[Sa>>2]=1588;c[Sa+4>>2]=0;c[e+1960>>2]=0;Sa=e+1968|0;c[Ka>>2]=0;c[Ka+4>>2]=0;c[Ka+8>>2]=0;Wa=ni(48)|0;c[Ka>>2]=Wa;c[Ka+8>>2]=-2147483600;c[Ka+4>>2]=40;Ta=Wa;Ua=10480;Va=Ta+40|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+40>>0]=0;c[La>>2]=0;c[La+4>>2]=0;c[La+8>>2]=0;Wa=ni(80)|0;c[La>>2]=Wa;c[La+8>>2]=-2147483568;c[La+4>>2]=70;Ta=Wa;Ua=10521;Va=Ta+70|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+70>>0]=0;c[Sa>>2]=0;wi(e+1972|0,Ka);wi(e+1984|0,La);Sa=e+2e3|0;c[Sa>>2]=1869;c[Sa+4>>2]=0;c[e+2008>>2]=0;Sa=e+2016|0;c[Ma>>2]=0;c[Ma+4>>2]=0;c[Ma+8>>2]=0;Wa=ni(64)|0;c[Ma>>2]=Wa;c[Ma+8>>2]=-2147483584;c[Ma+4>>2]=60;Ta=Wa;Ua=10592;Va=Ta+60|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+60>>0]=0;c[Na>>2]=0;c[Na+4>>2]=0;c[Na+8>>2]=0;Wa=ni(80)|0;c[Na>>2]=Wa;c[Na+8>>2]=-2147483568;c[Na+4>>2]=72;Ta=Wa;Ua=10653;Va=Ta+72|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+72>>0]=0;c[Sa>>2]=0;wi(e+2020|0,Ma);wi(e+2032|0,Na);Sa=e+2048|0;c[Sa>>2]=587;c[Sa+4>>2]=0;c[e+2056>>2]=0;Sa=e+2064|0;c[Oa>>2]=0;c[Oa+4>>2]=0;c[Oa+8>>2]=0;Wa=ni(48)|0;c[Oa>>2]=Wa;c[Oa+8>>2]=-2147483600;c[Oa+4>>2]=47;Ta=Wa;Ua=10726;Va=Ta+47|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+47>>0]=0;c[Pa>>2]=0;c[Pa+4>>2]=0;c[Pa+8>>2]=0;Wa=ni(80)|0;c[Pa>>2]=Wa;c[Pa+8>>2]=-2147483568;c[Pa+4>>2]=77;Ta=Wa;Ua=10774;Va=Ta+77|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+77>>0]=0;c[Sa>>2]=0;wi(e+2068|0,Oa);wi(e+2080|0,Pa);Sa=e+2096|0;c[Sa>>2]=1010;c[Sa+4>>2]=0;c[e+2104>>2]=0;Sa=e+2112|0;c[Qa>>2]=0;c[Qa+4>>2]=0;c[Qa+8>>2]=0;Wa=ni(64)|0;c[Qa>>2]=Wa;c[Qa+8>>2]=-2147483584;c[Qa+4>>2]=56;Ta=Wa;Ua=10852;Va=Ta+56|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+56>>0]=0;c[Ra>>2]=0;c[Ra+4>>2]=0;c[Ra+8>>2]=0;Wa=ni(64)|0;c[Ra>>2]=Wa;c[Ra+8>>2]=-2147483584;c[Ra+4>>2]=49;Ta=Wa;Ua=10909;Va=Ta+49|0;do{a[Ta>>0]=a[Ua>>0]|0;Ta=Ta+1|0;Ua=Ua+1|0}while((Ta|0)<(Va|0));a[Wa+49>>0]=0;c[Sa>>2]=0;wi(e+2116|0,Qa);wi(e+2128|0,Ra);Sa=e+2144|0;c[Sa>>2]=1824;c[Sa+4>>2]=0;c[e+2152>>2]=0;c[b>>2]=0;Sa=b+4|0;c[Sa>>2]=0;Wa=b+8|0;c[Wa>>2]=0;Ua=ni(2160)|0;c[Sa>>2]=Ua;c[b>>2]=Ua;c[Wa>>2]=Ua+2160;Wa=e+2160|0;b=e;Ta=Ua;do{c[Ta>>2]=c[b>>2];wi(Ta+4|0,b+4|0);wi(Ta+16|0,b+16|0);Ua=Ta+32|0;Va=b+32|0;c[Ua>>2]=c[Va>>2];c[Ua+4>>2]=c[Va+4>>2];c[Ua+8>>2]=c[Va+8>>2];b=b+48|0;Ta=Ta+48|0;c[Sa>>2]=Ta}while((b|0)!=(Wa|0));b=Wa;do{Wa=b+-32|0;if((a[Wa+11>>0]|0)<0)oi(c[Wa>>2]|0);Wa=b+-44|0;b=b+-48|0;if((a[Wa+11>>0]|0)<0)oi(c[Wa>>2]|0)}while((b|0)!=(e|0));if((a[Ra+11>>0]|0)<0)oi(c[Ra>>2]|0);if((a[Qa+11>>0]|0)<0)oi(c[Qa>>2]|0);if((a[Pa+11>>0]|0)<0)oi(c[Pa>>2]|0);if((a[Oa+11>>0]|0)<0)oi(c[Oa>>2]|0);if((a[Na+11>>0]|0)<0)oi(c[Na>>2]|0);if((a[Ma+11>>0]|0)<0)oi(c[Ma>>2]|0);if((a[La+11>>0]|0)<0)oi(c[La>>2]|0);if((a[Ka+11>>0]|0)<0)oi(c[Ka>>2]|0);if((a[Ha+11>>0]|0)<0)oi(c[Ha>>2]|0);if((a[Ga+11>>0]|0)<0)oi(c[Ga>>2]|0);if((a[Fa+11>>0]|0)<0)oi(c[Fa>>2]|0);if((a[Ea+11>>0]|0)<0)oi(c[Ea>>2]|0);if((a[Da+11>>0]|0)<0)oi(c[Da>>2]|0);if((a[Ca+11>>0]|0)<0)oi(c[Ca>>2]|0);if((a[Ba+11>>0]|0)<0)oi(c[Ba>>2]|0);if((a[Aa+11>>0]|0)<0)oi(c[Aa>>2]|0);if((a[za+11>>0]|0)<0)oi(c[za>>2]|0);if((a[ya+11>>0]|0)<0)oi(c[ya>>2]|0);if((a[xa+11>>0]|0)<0)oi(c[xa>>2]|0);if((a[wa+11>>0]|0)<0)oi(c[wa>>2]|0);if((a[va+11>>0]|0)<0)oi(c[va>>2]|0);if((a[ua+11>>0]|0)<0)oi(c[ua>>2]|0);if((a[ta+11>>0]|0)<0)oi(c[ta>>2]|0);if((a[sa+11>>0]|0)<0)oi(c[sa>>2]|0);if((a[ra+11>>0]|0)<0)oi(c[ra>>2]|0);if((a[qa+11>>0]|0)<0)oi(c[qa>>2]|0);if((a[pa+11>>0]|0)<0)oi(c[pa>>2]|0);if((a[oa+11>>0]|0)<0)oi(c[oa>>2]|0);if((a[na+11>>0]|0)<0)oi(c[na>>2]|0);if((a[ma+11>>0]|0)<0)oi(c[ma>>2]|0);if((a[la+11>>0]|0)<0)oi(c[la>>2]|0);if((a[ka+11>>0]|0)<0)oi(c[ka>>2]|0);if((a[ja+11>>0]|0)<0)oi(c[ja>>2]|0);if((a[ia+11>>0]|0)<0)oi(c[ia>>2]|0);if((a[ha+11>>0]|0)<0)oi(c[ha>>2]|0);if((a[ga+11>>0]|0)<0)oi(c[ga>>2]|0);if((a[fa+11>>0]|0)<0)oi(c[fa>>2]|0);if((a[ea+11>>0]|0)<0)oi(c[ea>>2]|0);if((a[da+11>>0]|0)<0)oi(c[da>>2]|0);if((a[ca+11>>0]|0)<0)oi(c[ca>>2]|0);if((a[ba+11>>0]|0)<0)oi(c[ba>>2]|0);if((a[aa+11>>0]|0)<0)oi(c[aa>>2]|0);if((a[$+11>>0]|0)<0)oi(c[$>>2]|0);if((a[_+11>>0]|0)<0)oi(c[_>>2]|0);if((a[Z+11>>0]|0)<0)oi(c[Z>>2]|0);if((a[Y+11>>0]|0)<0)oi(c[Y>>2]|0);if((a[X+11>>0]|0)<0)oi(c[X>>2]|0);if((a[W+11>>0]|0)<0)oi(c[W>>2]|0);if((a[V+11>>0]|0)<0)oi(c[V>>2]|0);if((a[U+11>>0]|0)<0)oi(c[U>>2]|0);if((a[T+11>>0]|0)<0)oi(c[T>>2]|0);if((a[S+11>>0]|0)<0)oi(c[S>>2]|0);if((a[R+11>>0]|0)<0)oi(c[R>>2]|0);if((a[Q+11>>0]|0)<0)oi(c[Q>>2]|0);if((a[P+11>>0]|0)<0)oi(c[P>>2]|0);if((a[O+11>>0]|0)<0)oi(c[O>>2]|0);if((a[N+11>>0]|0)<0)oi(c[N>>2]|0);if((a[M+11>>0]|0)<0)oi(c[M>>2]|0);if((a[L+11>>0]|0)<0)oi(c[L>>2]|0);if((a[K+11>>0]|0)<0)oi(c[K>>2]|0);if((a[J+11>>0]|0)<0)oi(c[J>>2]|0);if((a[I+11>>0]|0)<0)oi(c[I>>2]|0);if((a[H+11>>0]|0)<0)oi(c[H>>2]|0);if((a[G+11>>0]|0)<0)oi(c[G>>2]|0);if((a[F+11>>0]|0)<0)oi(c[F>>2]|0);if((a[E+11>>0]|0)<0)oi(c[E>>2]|0);if((a[D+11>>0]|0)<0)oi(c[D>>2]|0);if((a[C+11>>0]|0)<0)oi(c[C>>2]|0);if((a[A+11>>0]|0)<0)oi(c[A>>2]|0);if((a[z+11>>0]|0)<0)oi(c[z>>2]|0);if((a[y+11>>0]|0)<0)oi(c[y>>2]|0);if((a[x+11>>0]|0)<0)oi(c[x>>2]|0);if((a[w+11>>0]|0)<0)oi(c[w>>2]|0);if((a[v+11>>0]|0)<0)oi(c[v>>2]|0);if((a[u+11>>0]|0)<0)oi(c[u>>2]|0);if((a[t+11>>0]|0)<0)oi(c[t>>2]|0);if((a[s+11>>0]|0)<0)oi(c[s>>2]|0);if((a[r+11>>0]|0)<0)oi(c[r>>2]|0);if((a[q+11>>0]|0)<0)oi(c[q>>2]|0);if((a[p+11>>0]|0)<0)oi(c[p>>2]|0);if((a[o+11>>0]|0)<0)oi(c[o>>2]|0);if((a[n+11>>0]|0)<0)oi(c[n>>2]|0);if((a[m+11>>0]|0)<0)oi(c[m>>2]|0);if((a[l+11>>0]|0)<0)oi(c[l>>2]|0);if((a[k+11>>0]|0)<0)oi(c[k>>2]|0);if((a[j+11>>0]|0)<0)oi(c[j>>2]|0);if((a[i+11>>0]|0)<0)oi(c[i>>2]|0);if((a[h+11>>0]|0)<0)oi(c[h>>2]|0);if((a[g+11>>0]|0)<0)oi(c[g>>2]|0);if((a[f+11>>0]|0)>=0){Ia=d;return}oi(c[f>>2]|0);Ia=d;return}function cb(){var a=0,b=0;a=c[4576]|0;if(!a){b=da(4)|0;c[b>>2]=6096;ha(b|0,3736,117)}else{Pa[c[(c[a>>2]|0)+24>>2]&255](a);return}}function db(){var a=0,b=0,d=0,e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0;a=Ia;Ia=Ia+96|0;if((Ia|0)>=(Ja|0))B(96);b=a+56|0;d=a+48|0;e=a+40|0;g=a;h=a+88|0;i=a+80|0;di(16325)|0;eb(g);j=ni(80)|0;fb(j);c[h>>2]=j;k=ni(16)|0;c[k+4>>2]=0;c[k+8>>2]=0;c[k>>2]=5340;c[k+12>>2]=j;l=h+4|0;c[l>>2]=k;c[e>>2]=j;c[e+4>>2]=j;xg(h,e);j=ni(64)|0;gb(j);c[e>>2]=j;k=ni(16)|0;c[k+4>>2]=0;c[k+8>>2]=0;c[k>>2]=5368;c[k+12>>2]=j;m=e+4|0;c[m>>2]=k;c[d>>2]=j;c[d+4>>2]=j;Dg(e,d);j=ni(72)|0;hb(j);c[d>>2]=j;k=ni(16)|0;c[k+4>>2]=0;c[k+8>>2]=0;c[k>>2]=5396;c[k+12>>2]=j;n=d+4|0;c[n>>2]=k;c[b>>2]=j;c[b+4>>2]=j;Jg(d,b);j=c[e>>2]|0;k=c[m>>2]|0;o=(k|0)==0;if(o)p=g+32|0;else{q=k+4|0;c[q>>2]=(c[q>>2]|0)+1;c[q>>2]=(c[q>>2]|0)+1;p=g+32|0}c[p>>2]=j;j=g+36|0;p=c[j>>2]|0;c[j>>2]=k;if(p|0?(q=p+4|0,r=c[q>>2]|0,c[q>>2]=r+-1,(r|0)==0):0){Pa[c[(c[p>>2]|0)+8>>2]&255](p);mi(p)}p=c[g+32>>2]|0;r=g+24|0;q=r;s=c[q+4>>2]|0;t=p+24|0;c[t>>2]=c[q>>2];c[t+4>>2]=s;s=c[p+16>>2]|0;if(s|0){t=c[(c[s>>2]|0)+8>>2]|0;f[b>>2]=0.0;f[b+4>>2]=0.0;Ua[t&15](s,p+4|0,b,r)}if(!o?(o=k+4|0,r=c[o>>2]|0,c[o>>2]=r+-1,(r|0)==0):0){Pa[c[(c[k>>2]|0)+8>>2]&255](k);mi(k)}c[i>>2]=1;k=b+16|0;r=ni(24)|0;c[r>>2]=5424;c[r+4>>2]=i;c[r+8>>2]=g;c[r+12>>2]=h;c[r+16>>2]=e;c[r+20>>2]=d;c[k>>2]=r;dc(b,18288);r=c[k>>2]|0;if((b|0)!=(r|0)){if(r|0)Pa[c[(c[r>>2]|0)+20>>2]&255](r)}else Pa[c[(c[r>>2]|0)+16>>2]&255](r);za(2,0,1);r=c[n>>2]|0;if(r|0?(n=r+4|0,b=c[n>>2]|0,c[n>>2]=b+-1,(b|0)==0):0){Pa[c[(c[r>>2]|0)+8>>2]&255](r);mi(r)}r=c[m>>2]|0;if(r|0?(m=r+4|0,b=c[m>>2]|0,c[m>>2]=b+-1,(b|0)==0):0){Pa[c[(c[r>>2]|0)+8>>2]&255](r);mi(r)}r=c[l>>2]|0;if(r|0?(l=r+4|0,b=c[l>>2]|0,c[l>>2]=b+-1,(b|0)==0):0){Pa[c[(c[r>>2]|0)+8>>2]&255](r);mi(r)}r=c[j>>2]|0;if(r|0?(j=r+4|0,b=c[j>>2]|0,c[j>>2]=b+-1,(b|0)==0):0){Pa[c[(c[r>>2]|0)+8>>2]&255](r);mi(r)}r=c[g>>2]|0;if(!r){Ia=a;return 1}oi(r);Ia=a;return 1}function eb(a){a=a|0;var b=0,d=0,e=0;c[a>>2]=0;b=a+4|0;c[b>>2]=0;d=a+8|0;c[d>>2]=0;e=ni(512)|0;c[a>>2]=e;c[d>>2]=128;c[b>>2]=4096;Uj(e|0,0,512)|0;c[a+12>>2]=0;g[a+16>>3]=+wa();e=a+24|0;c[e>>2]=0;c[e+4>>2]=0;c[e+8>>2]=0;c[e+12>>2]=0;T();_(32)|0;ba(50,50,32,0)|0;return}function fb(b){b=b|0;var d=0,e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ba=0,ca=0,da=0,ea=0,fa=0,ga=0,ha=0,ia=0,ja=0,ka=0,la=0,ma=0,na=0,oa=0,pa=0,qa=0,ra=0,sa=0,ta=0,ua=0,va=0,wa=0,xa=0,ya=0;d=Ia;Ia=Ia+864|0;if((Ia|0)>=(Ja|0))B(864);e=d+776|0;g=d+768|0;h=d+752|0;i=d+704|0;j=d+696|0;k=d+688|0;l=d+680|0;m=d+632|0;n=d+584|0;o=d+536|0;p=d+432|0;q=d+328|0;r=d+224|0;s=d+144|0;t=d+512|0;u=d+408|0;v=d+304|0;w=d+856|0;x=d+848|0;y=d+120|0;z=d+96|0;A=d+72|0;C=d+840|0;D=d+48|0;E=d+24|0;F=d;G=d+832|0;H=d+824|0;I=d+816|0;J=d+808|0;K=d+800|0;L=d+792|0;M=d+784|0;N=b+4|0;c[N>>2]=0;c[N+4>>2]=0;c[N+8>>2]=0;c[N+12>>2]=0;c[N+16>>2]=0;c[N+20>>2]=0;c[N+24>>2]=0;c[b>>2]=3936;N=b+32|0;O=b+36|0;P=b+40|0;Q=b+44|0;R=b+48|0;S=b+52|0;T=b+56|0;U=b+60|0;V=b+64|0;W=b+68|0;X=b+72|0;Y=N;Z=Y+44|0;do{c[Y>>2]=0;Y=Y+4|0}while((Y|0)<(Z|0));_=p;c[_>>2]=5;c[_+4>>2]=5;_=p+8|0;c[_>>2]=2;c[_+4>>2]=2;c[p+16>>2]=255;c[p+20>>2]=255;c[p+24>>2]=255;c[p+28>>2]=255;c[p+32>>2]=0;c[p+36>>2]=0;c[p+40>>2]=255;c[p+44>>2]=255;c[p+48>>2]=0;c[p+52>>2]=255;c[p+56>>2]=0;c[p+60>>2]=255;c[p+64>>2]=255;c[p+68>>2]=0;c[p+72>>2]=0;c[p+76>>2]=255;rb(V,p);_=q;c[_>>2]=5;c[_+4>>2]=5;_=q+8|0;c[_>>2]=2;c[_+4>>2]=2;c[q+16>>2]=196;c[q+20>>2]=2;c[q+24>>2]=51;c[q+28>>2]=255;c[q+32>>2]=0;c[q+36>>2]=159;c[q+40>>2]=107;c[q+44>>2]=255;c[q+48>>2]=0;c[q+52>>2]=135;c[q+56>>2]=189;c[q+60>>2]=255;c[q+64>>2]=255;c[q+68>>2]=211;c[q+72>>2]=0;c[q+76>>2]=255;_=c[W>>2]|0;if((_|0)==(c[X>>2]|0)){rb(V,q);$=c[W>>2]|0}else{Y=_;aa=q;Z=Y+80|0;do{c[Y>>2]=c[aa>>2];Y=Y+4|0;aa=aa+4|0}while((Y|0)<(Z|0));_=(c[W>>2]|0)+80|0;c[W>>2]=_;$=_}_=r;c[_>>2]=5;c[_+4>>2]=5;_=r+8|0;c[_>>2]=2;c[_+4>>2]=2;c[r+16>>2]=255;c[r+20>>2]=0;c[r+24>>2]=136;c[r+28>>2]=255;c[r+32>>2]=0;c[r+36>>2]=0;c[r+40>>2]=255;c[r+44>>2]=255;c[r+48>>2]=68;c[r+52>>2]=204;c[r+56>>2]=0;c[r+60>>2]=255;c[r+64>>2]=255;c[r+68>>2]=255;c[r+72>>2]=0;c[r+76>>2]=255;if(($|0)==(c[X>>2]|0)){rb(V,r);ba=c[W>>2]|0}else{Y=$;aa=r;Z=Y+80|0;do{c[Y>>2]=c[aa>>2];Y=Y+4|0;aa=aa+4|0}while((Y|0)<(Z|0));r=(c[W>>2]|0)+80|0;c[W>>2]=r;ba=r}r=s;c[r>>2]=7;c[r+4>>2]=7;r=s+8|0;c[r>>2]=3;c[r+4>>2]=3;c[s+16>>2]=0;c[s+20>>2]=0;c[s+24>>2]=255;c[s+28>>2]=255;c[s+32>>2]=255;c[s+36>>2]=255;c[s+40>>2]=0;c[s+44>>2]=255;c[s+48>>2]=0;c[s+52>>2]=255;c[s+56>>2]=0;c[s+60>>2]=255;c[s+64>>2]=255;c[s+68>>2]=0;c[s+72>>2]=0;c[s+76>>2]=255;if((ba|0)==(c[X>>2]|0))rb(V,s);else{Y=ba;aa=s;Z=Y+80|0;do{c[Y>>2]=c[aa>>2];Y=Y+4|0;aa=aa+4|0}while((Y|0)<(Z|0));c[W>>2]=(c[W>>2]|0)+80}c[b+76>>2]=0;s=ni(328)|0;ba=b+4|0;jb(s,ba);c[p>>2]=s;X=ni(16)|0;c[X+4>>2]=0;c[X+8>>2]=0;c[X>>2]=4e3;c[X+12>>2]=s;r=p+4|0;c[r>>2]=X;c[o>>2]=s;c[o+4>>2]=s;zb(p,o);s=b+16|0;X=c[p>>2]|0;$=c[r>>2]|0;c[p>>2]=0;c[r>>2]=0;c[s>>2]=X;X=b+20|0;_=c[X>>2]|0;c[X>>2]=$;if(_|0?($=_+4|0,X=c[$>>2]|0,c[$>>2]=X+-1,(X|0)==0):0){Pa[c[(c[_>>2]|0)+8>>2]&255](_);mi(_)}_=c[r>>2]|0;if(_|0?(r=_+4|0,X=c[r>>2]|0,c[r>>2]=X+-1,(X|0)==0):0){Pa[c[(c[_>>2]|0)+8>>2]&255](_);mi(_)}_=c[(c[s>>2]|0)+4>>2]|0;X=c[ba>>2]|0;c[X+(_*48|0)+8>>2]=1065353216;c[X+(_*48|0)+12>>2]=1065353216;_=ni(328)|0;jb(_,ba);c[_>>2]=4028;Y=o+8|0;Z=Y+36|0;do{c[Y>>2]=0;Y=Y+4|0}while((Y|0)<(Z|0));c[o+44>>2]=5;c[o>>2]=0;c[o+4>>2]=0;c[o+16>>2]=0;c[o+20>>2]=0;c[o+36>>2]=-1;X=b+8|0;r=c[X>>2]|0;$=c[ba>>2]|0;c[$+((c[_+4>>2]|0)*48|0)+36>>2]=(r-$|0)/48|0;$=b+12|0;if((c[$>>2]|0)==(r|0))Gb(ba,o);else{Y=r;aa=o;Z=Y+48|0;do{c[Y>>2]=c[aa>>2];Y=Y+4|0;aa=aa+4|0}while((Y|0)<(Z|0));c[X>>2]=(c[X>>2]|0)+48}c[p>>2]=_;r=ni(16)|0;c[r+4>>2]=0;c[r+8>>2]=0;c[r>>2]=4052;c[r+12>>2]=_;ca=p+4|0;c[ca>>2]=r;c[n>>2]=_;c[n+4>>2]=_;Hb(p,n);_=c[p>>2]|0;r=_+4|0;da=c[r>>2]|0;ea=c[ba>>2]|0;c[ea+(da*48|0)+8>>2]=0;c[ea+(da*48|0)+12>>2]=1065353216;da=c[r>>2]|0;r=c[ba>>2]|0;c[r+(da*48|0)+24>>2]=1120403456;c[r+(da*48|0)+28>>2]=0;c[_+60>>2]=2;if((c[W>>2]|0)!=(c[V>>2]|0)){_=n+8|0;da=n+44|0;r=n+4|0;ea=n+16|0;fa=n+20|0;ga=n+24|0;ha=n+28|0;ia=n+36|0;ja=o+4|0;ka=n+4|0;la=q+11|0;ma=t+16|0;na=u+16|0;oa=v+16|0;pa=b;qa=w+4|0;ra=x+4|0;sa=0;do{ta=ni(328)|0;ua=(sa|0)==0;jb(ta,ba);va=ua?255:-2139062017;c[ta>>2]=4080;Y=_;Z=Y+36|0;do{c[Y>>2]=0;Y=Y+4|0}while((Y|0)<(Z|0));c[da>>2]=6;c[n>>2]=0;c[r>>2]=0;c[ea>>2]=0;c[fa>>2]=0;f[ga>>2]=2.0;c[ha>>2]=0;c[ia>>2]=va;wa=c[X>>2]|0;xa=c[ba>>2]|0;c[xa+((c[ta+4>>2]|0)*48|0)+36>>2]=(wa-xa|0)/48|0;if((c[$>>2]|0)==(wa|0))Gb(ba,n);else{Y=wa;aa=n;Z=Y+48|0;do{c[Y>>2]=c[aa>>2];Y=Y+4|0;aa=aa+4|0}while((Y|0)<(Z|0));c[X>>2]=(c[X>>2]|0)+48}c[o>>2]=ta;va=ni(16)|0;c[va+4>>2]=0;c[va+8>>2]=0;c[va>>2]=4104;c[va+12>>2]=ta;c[ja>>2]=va;c[l>>2]=ta;c[l+4>>2]=ta;Ob(o,l);va=(c[o>>2]|0)+4|0;wa=c[va>>2]|0;xa=c[ba>>2]|0;c[xa+(wa*48|0)+16>>2]=1101004800;c[xa+(wa*48|0)+20>>2]=1101004800;wa=c[va>>2]|0;va=c[ba>>2]|0;c[va+(wa*48|0)+24>>2]=1114636288;c[va+(wa*48|0)+28>>2]=1114636288;wa=ni(328)|0;va=sa;sa=sa+1|0;Li(q,sa);kb(wa,ba,q,255,10.0);c[n>>2]=wa;xa=ni(16)|0;c[xa+4>>2]=0;c[xa+8>>2]=0;c[xa>>2]=4156;c[xa+12>>2]=wa;c[ka>>2]=xa;c[k>>2]=wa;c[k+4>>2]=wa;zb(n,k);if((a[la>>0]|0)<0)oi(c[q>>2]|0);wa=c[(c[n>>2]|0)+4>>2]|0;xa=c[ba>>2]|0;c[xa+(wa*48|0)>>2]=1056964608;c[xa+(wa*48|0)+4>>2]=1050253722;wa=c[n>>2]|0;c[wa+8>>2]=1056964608;c[wa+12>>2]=1056964608;xa=c[wa+4>>2]|0;wa=c[ba>>2]|0;c[wa+(xa*48|0)+8>>2]=1060320051;c[wa+(xa*48|0)+12>>2]=1060320051;xa=c[o>>2]|0;c[ma>>2]=0;c[na>>2]=0;wa=c[ja>>2]|0;if(wa|0){ya=wa+4|0;c[ya>>2]=(c[ya>>2]|0)+1}c[oa>>2]=0;ya=ni(20)|0;c[ya>>2]=4184;c[ya+4>>2]=va;c[ya+8>>2]=xa;c[ya+12>>2]=wa;c[ya+16>>2]=pa;c[oa>>2]=ya;lb(xa,t,u,v);xa=c[oa>>2]|0;if((v|0)!=(xa|0)){if(xa|0)Pa[c[(c[xa>>2]|0)+20>>2]&255](xa)}else Pa[c[(c[xa>>2]|0)+16>>2]&255](xa);xa=c[na>>2]|0;if((u|0)!=(xa|0)){if(xa|0)Pa[c[(c[xa>>2]|0)+20>>2]&255](xa)}else Pa[c[(c[xa>>2]|0)+16>>2]&255](xa);xa=c[ma>>2]|0;if((t|0)!=(xa|0)){if(xa|0)Pa[c[(c[xa>>2]|0)+20>>2]&255](xa)}else Pa[c[(c[xa>>2]|0)+16>>2]&255](xa);xa=c[o>>2]|0;ya=c[(c[xa>>2]|0)+4>>2]|0;c[w>>2]=c[n>>2];wa=c[ka>>2]|0;c[qa>>2]=wa;if(wa|0){va=wa+4|0;c[va>>2]=(c[va>>2]|0)+1}Ta[ya&3](xa,ba,w);xa=c[qa>>2]|0;if(xa|0?(ya=xa+4|0,va=c[ya>>2]|0,c[ya>>2]=va+-1,(va|0)==0):0){Pa[c[(c[xa>>2]|0)+8>>2]&255](xa);mi(xa)}xa=c[p>>2]|0;va=c[(c[xa>>2]|0)+4>>2]|0;c[x>>2]=c[o>>2];ya=c[ja>>2]|0;c[ra>>2]=ya;if(ya|0){wa=ya+4|0;c[wa>>2]=(c[wa>>2]|0)+1}Ta[va&3](xa,ba,x);xa=c[ra>>2]|0;do if(xa|0){va=xa+4|0;wa=c[va>>2]|0;c[va>>2]=wa+-1;if(wa|0)break;Pa[c[(c[xa>>2]|0)+8>>2]&255](xa);mi(xa)}while(0);do if(ua){xa=c[o>>2]|0;ta=c[ja>>2]|0;if(ta|0){wa=ta+4|0;c[wa>>2]=(c[wa>>2]|0)+1}c[P>>2]=xa;xa=c[Q>>2]|0;c[Q>>2]=ta;if(!xa)break;ta=xa+4|0;wa=c[ta>>2]|0;c[ta>>2]=wa+-1;if(wa|0)break;Pa[c[(c[xa>>2]|0)+8>>2]&255](xa);mi(xa)}while(0);ua=c[ka>>2]|0;do if(ua|0){xa=ua+4|0;wa=c[xa>>2]|0;c[xa>>2]=wa+-1;if(wa|0)break;Pa[c[(c[ua>>2]|0)+8>>2]&255](ua);mi(ua)}while(0);ua=c[ja>>2]|0;do if(ua|0){wa=ua+4|0;xa=c[wa>>2]|0;c[wa>>2]=xa+-1;if(xa|0)break;Pa[c[(c[ua>>2]|0)+8>>2]&255](ua);mi(ua)}while(0)}while(sa>>>0<(((c[W>>2]|0)-(c[V>>2]|0)|0)/80|0)>>>0)}W=ni(328)|0;jb(W,ba);c[n>>2]=W;sa=ni(16)|0;c[sa+4>>2]=0;c[sa+8>>2]=0;c[sa>>2]=4e3;c[sa+12>>2]=W;ja=n+4|0;c[ja>>2]=sa;c[m>>2]=W;c[m+4>>2]=W;zb(n,m);W=(c[n>>2]|0)+4|0;sa=c[W>>2]|0;ka=c[ba>>2]|0;c[ka+(sa*48|0)+8>>2]=1065353216;c[ka+(sa*48|0)+12>>2]=1065353216;sa=c[W>>2]|0;ka=c[ba>>2]|0;c[ka+(sa*48|0)+24>>2]=-1027080192;c[ka+(sa*48|0)+28>>2]=0;sa=c[W>>2]|0;W=c[ba>>2]|0;c[W+(sa*48|0)+16>>2]=1120403456;c[W+(sa*48|0)+20>>2]=0;sa=ni(328)|0;jb(sa,ba);c[sa>>2]=4080;Y=m+8|0;Z=Y+36|0;do{c[Y>>2]=0;Y=Y+4|0}while((Y|0)<(Z|0));c[m+44>>2]=6;c[m>>2]=0;c[m+4>>2]=0;c[m+16>>2]=0;c[m+20>>2]=0;f[m+24>>2]=2.0;c[m+28>>2]=0;c[m+36>>2]=-1;W=c[X>>2]|0;ka=c[ba>>2]|0;c[ka+((c[sa+4>>2]|0)*48|0)+36>>2]=(W-ka|0)/48|0;if((c[$>>2]|0)==(W|0))Gb(ba,m);else{Y=W;aa=m;Z=Y+48|0;do{c[Y>>2]=c[aa>>2];Y=Y+4|0;aa=aa+4|0}while((Y|0)<(Z|0));c[X>>2]=(c[X>>2]|0)+48}c[o>>2]=sa;W=ni(16)|0;c[W+4>>2]=0;c[W+8>>2]=0;c[W>>2]=4104;c[W+12>>2]=sa;ka=o+4|0;c[ka>>2]=W;c[j>>2]=sa;c[j+4>>2]=sa;Ob(o,j);sa=(c[o>>2]|0)+4|0;W=c[sa>>2]|0;Q=c[ba>>2]|0;c[Q+(W*48|0)+24>>2]=1125515264;c[Q+(W*48|0)+28>>2]=1112014848;W=c[sa>>2]|0;sa=c[ba>>2]|0;c[sa+(W*48|0)>>2]=1065353216;c[sa+(W*48|0)+4>>2]=0;W=c[o>>2]|0;sa=c[W+4>>2]|0;Q=c[ba>>2]|0;c[Q+(sa*48|0)+16>>2]=-1043857408;c[Q+(sa*48|0)+20>>2]=1103626240;c[W+8>>2]=1065353216;c[W+12>>2]=0;sa=y+16|0;c[y>>2]=4228;c[sa>>2]=y;Q=z+16|0;c[z>>2]=4272;c[Q>>2]=z;P=b;ra=A+16|0;c[A>>2]=4316;c[A+4>>2]=P;c[ra>>2]=A;lb(W,y,z,A);W=c[ra>>2]|0;if((A|0)!=(W|0)){if(W|0)Pa[c[(c[W>>2]|0)+20>>2]&255](W)}else Pa[c[(c[W>>2]|0)+16>>2]&255](W);W=c[Q>>2]|0;if((z|0)!=(W|0)){if(W|0)Pa[c[(c[W>>2]|0)+20>>2]&255](W)}else Pa[c[(c[W>>2]|0)+16>>2]&255](W);W=c[sa>>2]|0;if((y|0)!=(W|0)){if(W|0)Pa[c[(c[W>>2]|0)+20>>2]&255](W)}else Pa[c[(c[W>>2]|0)+16>>2]&255](W);W=ni(328)|0;c[m>>2]=0;c[m+4>>2]=0;c[m+8>>2]=0;y=m+11|0;a[y>>0]=9;Y=m;aa=11027;Z=Y+9|0;do{a[Y>>0]=a[aa>>0]|0;Y=Y+1|0;aa=aa+1|0}while((Y|0)<(Z|0));a[m+9>>0]=0;kb(W,ba,m,-1,10.0);c[j>>2]=W;sa=ni(16)|0;c[sa+4>>2]=0;c[sa+8>>2]=0;c[sa>>2]=4156;c[sa+12>>2]=W;z=j+4|0;c[z>>2]=sa;c[i>>2]=W;c[i+4>>2]=W;zb(j,i);if((a[y>>0]|0)<0)oi(c[m>>2]|0);y=c[(c[j>>2]|0)+4>>2]|0;W=c[ba>>2]|0;c[W+(y*48|0)>>2]=1056964608;c[W+(y*48|0)+4>>2]=1053609165;y=c[j>>2]|0;c[y+8>>2]=1056964608;c[y+12>>2]=1056964608;W=c[y+4>>2]|0;y=c[ba>>2]|0;c[y+(W*48|0)+8>>2]=1062836634;c[y+(W*48|0)+12>>2]=1065353216;W=ni(328)|0;jb(W,ba);c[W>>2]=4028;Y=i+8|0;Z=Y+36|0;do{c[Y>>2]=0;Y=Y+4|0}while((Y|0)<(Z|0));c[i+44>>2]=5;c[i>>2]=0;c[i+4>>2]=0;c[i+16>>2]=0;c[i+20>>2]=0;c[i+36>>2]=-1;y=c[X>>2]|0;sa=c[ba>>2]|0;c[sa+((c[W+4>>2]|0)*48|0)+36>>2]=(y-sa|0)/48|0;if((c[$>>2]|0)==(y|0))Gb(ba,i);else{Y=y;aa=i;Z=Y+48|0;do{c[Y>>2]=c[aa>>2];Y=Y+4|0;aa=aa+4|0}while((Y|0)<(Z|0));c[X>>2]=(c[X>>2]|0)+48}c[m>>2]=W;X=ni(16)|0;c[X+4>>2]=0;c[X+8>>2]=0;c[X>>2]=4052;c[X+12>>2]=W;aa=m+4|0;c[aa>>2]=X;c[e>>2]=W;c[e+4>>2]=W;Hb(m,e);W=c[m>>2]|0;X=c[aa>>2]|0;c[m>>2]=0;c[aa>>2]=0;c[N>>2]=W;W=c[O>>2]|0;c[O>>2]=X;if(W|0?(X=W+4|0,m=c[X>>2]|0,c[X>>2]=m+-1,(m|0)==0):0){Pa[c[(c[W>>2]|0)+8>>2]&255](W);mi(W)}W=c[aa>>2]|0;if(W|0?(aa=W+4|0,m=c[aa>>2]|0,c[aa>>2]=m+-1,(m|0)==0):0){Pa[c[(c[W>>2]|0)+8>>2]&255](W);mi(W)}W=c[N>>2]|0;Ta[c[c[W>>2]>>2]&3](W,ba,1);W=c[N>>2]|0;f[W+52>>2]=1.0;m=c[W+4>>2]|0;W=c[ba>>2]|0;c[W+(m*48|0)+8>>2]=1065353216;c[W+(m*48|0)+12>>2]=1065353216;m=c[(c[N>>2]|0)+4>>2]|0;W=c[ba>>2]|0;c[W+(m*48|0)+24>>2]=-1027080192;c[W+(m*48|0)+28>>2]=-1027080192;m=c[(c[N>>2]|0)+4>>2]|0;W=c[ba>>2]|0;c[W+(m*48|0)>>2]=1056964608;c[W+(m*48|0)+4>>2]=1056964608;m=c[N>>2]|0;c[m+8>>2]=1056964608;c[m+12>>2]=1056964608;m=c[N>>2]|0;Ta[c[c[m>>2]>>2]&3](m,ba,1);f[(c[N>>2]|0)+52>>2]=1.0;m=ni(464)|0;c[C>>2]=7;c[C+4>>2]=7;W=D+16|0;c[W>>2]=0;aa=E+16|0;c[E>>2]=4412;c[E+4>>2]=P;c[aa>>2]=E;X=F+16|0;c[F>>2]=4508;c[F+4>>2]=P;c[X>>2]=F;c[e>>2]=c[C>>2];c[e+4>>2]=c[C+4>>2];mb(m,ba,e,0.0,D,E,F);c[i>>2]=m;C=ni(16)|0;c[C+4>>2]=0;c[C+8>>2]=0;c[C>>2]=4740;c[C+12>>2]=m;P=i+4|0;c[P>>2]=C;c[h>>2]=m;c[h+4>>2]=m;fe(i,h);m=c[i>>2]|0;C=c[P>>2]|0;c[i>>2]=0;c[P>>2]=0;c[T>>2]=m;m=c[U>>2]|0;c[U>>2]=C;if(m|0?(C=m+4|0,i=c[C>>2]|0,c[C>>2]=i+-1,(i|0)==0):0){Pa[c[(c[m>>2]|0)+8>>2]&255](m);mi(m)}m=c[P>>2]|0;if(m|0?(P=m+4|0,i=c[P>>2]|0,c[P>>2]=i+-1,(i|0)==0):0){Pa[c[(c[m>>2]|0)+8>>2]&255](m);mi(m)}m=c[X>>2]|0;if((F|0)!=(m|0)){if(m|0)Pa[c[(c[m>>2]|0)+20>>2]&255](m)}else Pa[c[(c[m>>2]|0)+16>>2]&255](m);m=c[aa>>2]|0;do if((E|0)==(m|0))Pa[c[(c[m>>2]|0)+16>>2]&255](m);else{if(!m)break;Pa[c[(c[m>>2]|0)+20>>2]&255](m)}while(0);m=c[W>>2]|0;do if((D|0)==(m|0))Pa[c[(c[m>>2]|0)+16>>2]&255](m);else{if(!m)break;Pa[c[(c[m>>2]|0)+20>>2]&255](m)}while(0);m=c[(c[T>>2]|0)+4>>2]|0;D=c[ba>>2]|0;c[D+(m*48|0)+8>>2]=1065353216;c[D+(m*48|0)+12>>2]=1065353216;m=ni(328)|0;c[h>>2]=0;c[h+4>>2]=0;c[h+8>>2]=0;D=h+11|0;a[D>>0]=5;a[h>>0]=a[11037]|0;a[h+1>>0]=a[11038]|0;a[h+2>>0]=a[11039]|0;a[h+3>>0]=a[11040]|0;a[h+4>>0]=a[11041]|0;a[h+5>>0]=0;kb(m,ba,h,-1,150.0);c[e>>2]=m;W=ni(16)|0;c[W+4>>2]=0;c[W+8>>2]=0;c[W>>2]=4156;c[W+12>>2]=m;E=e+4|0;c[E>>2]=W;c[g>>2]=m;c[g+4>>2]=m;le(e,g);g=c[e>>2]|0;m=c[E>>2]|0;c[e>>2]=0;c[E>>2]=0;c[R>>2]=g;g=c[S>>2]|0;c[S>>2]=m;do if(g|0){m=g+4|0;e=c[m>>2]|0;c[m>>2]=e+-1;if(e|0)break;Pa[c[(c[g>>2]|0)+8>>2]&255](g);mi(g)}while(0);g=c[E>>2]|0;do if(g|0){E=g+4|0;e=c[E>>2]|0;c[E>>2]=e+-1;if(e|0)break;Pa[c[(c[g>>2]|0)+8>>2]&255](g);mi(g)}while(0);if((a[D>>0]|0)<0)oi(c[h>>2]|0);h=c[R>>2]|0;Ta[c[c[h>>2]>>2]&3](h,ba,2);h=c[(c[R>>2]|0)+4>>2]|0;D=c[ba>>2]|0;c[D+(h*48|0)>>2]=1056964608;c[D+(h*48|0)+4>>2]=1056964608;h=c[R>>2]|0;c[h+8>>2]=1056964608;c[h+12>>2]=1056964608;h=c[R>>2]|0;a[h+65>>0]=0;a[h+145>>0]=0;a[h+225>>0]=0;c[(c[ba>>2]|0)+((c[h+4>>2]|0)*48|0)+40>>2]=0;h=c[N>>2]|0;D=c[(c[h>>2]|0)+4>>2]|0;c[G>>2]=c[T>>2];T=G+4|0;g=c[U>>2]|0;c[T>>2]=g;if(g|0){U=g+4|0;c[U>>2]=(c[U>>2]|0)+1}Ta[D&3](h,ba,G);G=c[T>>2]|0;do if(G|0){T=G+4|0;h=c[T>>2]|0;c[T>>2]=h+-1;if(h|0)break;Pa[c[(c[G>>2]|0)+8>>2]&255](G);mi(G)}while(0);G=c[o>>2]|0;h=c[(c[G>>2]|0)+4>>2]|0;c[H>>2]=c[j>>2];j=H+4|0;T=c[z>>2]|0;c[j>>2]=T;if(T|0){D=T+4|0;c[D>>2]=(c[D>>2]|0)+1}Ta[h&3](G,ba,H);H=c[j>>2]|0;do if(H|0){j=H+4|0;G=c[j>>2]|0;c[j>>2]=G+-1;if(G|0)break;Pa[c[(c[H>>2]|0)+8>>2]&255](H);mi(H)}while(0);H=c[n>>2]|0;G=c[(c[H>>2]|0)+4>>2]|0;c[I>>2]=c[N>>2];N=I+4|0;j=c[O>>2]|0;c[N>>2]=j;if(j|0){O=j+4|0;c[O>>2]=(c[O>>2]|0)+1}Ta[G&3](H,ba,I);I=c[N>>2]|0;do if(I|0){N=I+4|0;H=c[N>>2]|0;c[N>>2]=H+-1;if(H|0)break;Pa[c[(c[I>>2]|0)+8>>2]&255](I);mi(I)}while(0);I=c[n>>2]|0;H=c[(c[I>>2]|0)+4>>2]|0;c[J>>2]=c[o>>2];o=J+4|0;N=c[ka>>2]|0;c[o>>2]=N;if(N|0){G=N+4|0;c[G>>2]=(c[G>>2]|0)+1}Ta[H&3](I,ba,J);J=c[o>>2]|0;do if(J|0){o=J+4|0;I=c[o>>2]|0;c[o>>2]=I+-1;if(I|0)break;Pa[c[(c[J>>2]|0)+8>>2]&255](J);mi(J)}while(0);J=c[n>>2]|0;I=c[(c[J>>2]|0)+4>>2]|0;c[K>>2]=c[R>>2];R=K+4|0;o=c[S>>2]|0;c[R>>2]=o;if(o|0){S=o+4|0;c[S>>2]=(c[S>>2]|0)+1}Ta[I&3](J,ba,K);K=c[R>>2]|0;do if(K|0){R=K+4|0;J=c[R>>2]|0;c[R>>2]=J+-1;if(J|0)break;Pa[c[(c[K>>2]|0)+8>>2]&255](K);mi(K)}while(0);K=c[s>>2]|0;J=c[(c[K>>2]|0)+4>>2]|0;c[L>>2]=c[p>>2];p=L+4|0;R=c[ca>>2]|0;c[p>>2]=R;if(R|0){I=R+4|0;c[I>>2]=(c[I>>2]|0)+1}Ta[J&3](K,ba,L);L=c[p>>2]|0;do if(L|0){p=L+4|0;K=c[p>>2]|0;c[p>>2]=K+-1;if(K|0)break;Pa[c[(c[L>>2]|0)+8>>2]&255](L);mi(L)}while(0);L=c[s>>2]|0;s=c[(c[L>>2]|0)+4>>2]|0;c[M>>2]=c[n>>2];n=M+4|0;K=c[ja>>2]|0;c[n>>2]=K;if(K|0){p=K+4|0;c[p>>2]=(c[p>>2]|0)+1}Ta[s&3](L,ba,M);M=c[n>>2]|0;do if(M|0){n=M+4|0;ba=c[n>>2]|0;c[n>>2]=ba+-1;if(ba|0)break;Pa[c[(c[M>>2]|0)+8>>2]&255](M);mi(M)}while(0);nb(b,c[V>>2]|0);V=c[z>>2]|0;do if(V|0){z=V+4|0;b=c[z>>2]|0;c[z>>2]=b+-1;if(b|0)break;Pa[c[(c[V>>2]|0)+8>>2]&255](V);mi(V)}while(0);V=c[ka>>2]|0;do if(V|0){ka=V+4|0;b=c[ka>>2]|0;c[ka>>2]=b+-1;if(b|0)break;Pa[c[(c[V>>2]|0)+8>>2]&255](V);mi(V)}while(0);V=c[ja>>2]|0;do if(V|0){ja=V+4|0;b=c[ja>>2]|0;c[ja>>2]=b+-1;if(b|0)break;Pa[c[(c[V>>2]|0)+8>>2]&255](V);mi(V)}while(0);V=c[ca>>2]|0;if(!V){Ia=d;return}ca=V+4|0;b=c[ca>>2]|0;c[ca>>2]=b+-1;if(b|0){Ia=d;return}Pa[c[(c[V>>2]|0)+8>>2]&255](V);mi(V);Ia=d;return}function gb(b){b=b|0;var d=0,e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,C=0,D=0,E=0;d=Ia;Ia=Ia+272|0;if((Ia|0)>=(Ja|0))B(272);e=d+176|0;g=d+168|0;h=d+152|0;i=d+144|0;j=d+248|0;k=d+256|0;l=d+120|0;m=d+96|0;n=d+72|0;o=d+48|0;p=d+24|0;q=d;r=d+240|0;s=d+232|0;t=d+224|0;u=b+4|0;c[u>>2]=0;c[u+4>>2]=0;c[u+8>>2]=0;c[u+12>>2]=0;c[u+16>>2]=0;c[u+20>>2]=0;c[u+24>>2]=0;c[b>>2]=4856;bb(b+32|0);u=b+44|0;v=b+56|0;w=b+60|0;c[u>>2]=0;c[u+4>>2]=0;c[u+8>>2]=0;c[u+12>>2]=0;c[u+16>>2]=0;u=ni(328)|0;x=b+4|0;jb(u,x);c[j>>2]=u;y=ni(16)|0;c[y+4>>2]=0;c[y+8>>2]=0;c[y>>2]=4e3;c[y+12>>2]=u;z=j+4|0;c[z>>2]=y;c[e>>2]=u;c[e+4>>2]=u;zb(j,e);u=b+16|0;y=c[j>>2]|0;A=c[z>>2]|0;c[j>>2]=0;c[z>>2]=0;c[u>>2]=y;y=b+20|0;C=c[y>>2]|0;c[y>>2]=A;if(C|0?(A=C+4|0,y=c[A>>2]|0,c[A>>2]=y+-1,(y|0)==0):0){Pa[c[(c[C>>2]|0)+8>>2]&255](C);mi(C)}C=c[z>>2]|0;if(C|0?(z=C+4|0,y=c[z>>2]|0,c[z>>2]=y+-1,(y|0)==0):0){Pa[c[(c[C>>2]|0)+8>>2]&255](C);mi(C)}C=c[(c[u>>2]|0)+4>>2]|0;y=c[x>>2]|0;c[y+(C*48|0)+8>>2]=1065353216;c[y+(C*48|0)+12>>2]=1065353216;C=ni(464)|0;c[k>>2]=1;c[k+4>>2]=5;y=l+16|0;c[y>>2]=0;z=b;A=m+16|0;c[m>>2]=4876;c[m+4>>2]=z;c[A>>2]=m;D=n+16|0;c[n>>2]=4968;c[n+4>>2]=z;c[D>>2]=n;c[e>>2]=c[k>>2];c[e+4>>2]=c[k+4>>2];mb(C,x,e,.20000000298023224,l,m,n);c[j>>2]=C;k=ni(16)|0;c[k+4>>2]=0;c[k+8>>2]=0;c[k>>2]=4740;c[k+12>>2]=C;E=j+4|0;c[E>>2]=k;c[i>>2]=C;c[i+4>>2]=C;fe(j,i);C=c[j>>2]|0;k=c[E>>2]|0;c[j>>2]=0;c[E>>2]=0;c[v>>2]=C;C=c[w>>2]|0;c[w>>2]=k;if(C|0?(k=C+4|0,j=c[k>>2]|0,c[k>>2]=j+-1,(j|0)==0):0){Pa[c[(c[C>>2]|0)+8>>2]&255](C);mi(C)}C=c[E>>2]|0;if(C|0?(E=C+4|0,j=c[E>>2]|0,c[E>>2]=j+-1,(j|0)==0):0){Pa[c[(c[C>>2]|0)+8>>2]&255](C);mi(C)}C=c[D>>2]|0;if((n|0)!=(C|0)){if(C|0)Pa[c[(c[C>>2]|0)+20>>2]&255](C)}else Pa[c[(c[C>>2]|0)+16>>2]&255](C);C=c[A>>2]|0;if((m|0)!=(C|0)){if(C|0)Pa[c[(c[C>>2]|0)+20>>2]&255](C)}else Pa[c[(c[C>>2]|0)+16>>2]&255](C);C=c[y>>2]|0;if((l|0)!=(C|0)){if(C|0)Pa[c[(c[C>>2]|0)+20>>2]&255](C)}else Pa[c[(c[C>>2]|0)+16>>2]&255](C);C=c[(c[v>>2]|0)+4>>2]|0;l=c[x>>2]|0;c[l+(C*48|0)+24>>2]=0;c[l+(C*48|0)+28>>2]=1128792064;C=c[(c[v>>2]|0)+4>>2]|0;l=c[x>>2]|0;c[l+(C*48|0)+8>>2]=1063675494;c[l+(C*48|0)+12>>2]=0;C=c[(c[v>>2]|0)+4>>2]|0;l=c[x>>2]|0;c[l+(C*48|0)>>2]=1056964608;c[l+(C*48|0)+4>>2]=1056964608;C=c[v>>2]|0;c[C+8>>2]=1056964608;c[C+12>>2]=1056964608;C=ni(328)|0;jb(C,x);c[C>>2]=4080;l=e+8|0;y=l+36|0;do{c[l>>2]=0;l=l+4|0}while((l|0)<(y|0));c[e+44>>2]=6;c[e>>2]=0;c[e+4>>2]=0;c[e+16>>2]=0;c[e+20>>2]=0;f[e+24>>2]=2.0;c[e+28>>2]=0;c[e+36>>2]=-1;m=b+8|0;A=c[m>>2]|0;n=c[x>>2]|0;c[n+((c[C+4>>2]|0)*48|0)+36>>2]=(A-n|0)/48|0;if((c[b+12>>2]|0)==(A|0))Gb(x,e);else{l=A;A=e;y=l+48|0;do{c[l>>2]=c[A>>2];l=l+4|0;A=A+4|0}while((l|0)<(y|0));c[m>>2]=(c[m>>2]|0)+48}c[i>>2]=C;m=ni(16)|0;c[m+4>>2]=0;c[m+8>>2]=0;c[m>>2]=4104;c[m+12>>2]=C;A=i+4|0;c[A>>2]=m;c[h>>2]=C;c[h+4>>2]=C;Ob(i,h);C=(c[i>>2]|0)+4|0;m=c[C>>2]|0;l=c[x>>2]|0;c[l+(m*48|0)+24>>2]=1125515264;c[l+(m*48|0)+28>>2]=1112014848;m=c[C>>2]|0;C=c[x>>2]|0;c[C+(m*48|0)>>2]=1065353216;c[C+(m*48|0)+4>>2]=0;m=c[i>>2]|0;C=c[m+4>>2]|0;l=c[x>>2]|0;c[l+(C*48|0)+16>>2]=-1043857408;c[l+(C*48|0)+20>>2]=1103626240;c[m+8>>2]=1065353216;c[m+12>>2]=0;C=o+16|0;c[o>>2]=5012;c[C>>2]=o;l=p+16|0;c[p>>2]=5056;c[l>>2]=p;y=q+16|0;c[q>>2]=5100;c[q+4>>2]=z;c[y>>2]=q;lb(m,o,p,q);m=c[y>>2]|0;if((q|0)!=(m|0)){if(m|0)Pa[c[(c[m>>2]|0)+20>>2]&255](m)}else Pa[c[(c[m>>2]|0)+16>>2]&255](m);m=c[l>>2]|0;if((p|0)!=(m|0)){if(m|0)Pa[c[(c[m>>2]|0)+20>>2]&255](m)}else Pa[c[(c[m>>2]|0)+16>>2]&255](m);m=c[C>>2]|0;if((o|0)!=(m|0)){if(m|0)Pa[c[(c[m>>2]|0)+20>>2]&255](m)}else Pa[c[(c[m>>2]|0)+16>>2]&255](m);m=ni(328)|0;c[h>>2]=0;c[h+4>>2]=0;c[h+8>>2]=0;o=h+11|0;a[o>>0]=8;C=h;c[C>>2]=1162757447;c[C+4>>2]=1163149650;a[h+8>>0]=0;kb(m,x,h,-1,10.0);c[e>>2]=m;C=ni(16)|0;c[C+4>>2]=0;c[C+8>>2]=0;c[C>>2]=4156;c[C+12>>2]=m;p=e+4|0;c[p>>2]=C;c[g>>2]=m;c[g+4>>2]=m;zb(e,g);if((a[o>>0]|0)<0)oi(c[h>>2]|0);h=c[(c[e>>2]|0)+4>>2]|0;o=c[x>>2]|0;c[o+(h*48|0)>>2]=1056964608;c[o+(h*48|0)+4>>2]=1053609165;h=c[e>>2]|0;c[h+8>>2]=1056964608;c[h+12>>2]=1056964608;e=c[h+4>>2]|0;o=c[x>>2]|0;c[o+(e*48|0)+8>>2]=1062836634;c[o+(e*48|0)+12>>2]=1065353216;e=c[i>>2]|0;o=c[(c[e>>2]|0)+4>>2]|0;c[r>>2]=h;h=r+4|0;g=c[p>>2]|0;c[h>>2]=g;if(g|0){m=g+4|0;c[m>>2]=(c[m>>2]|0)+1}Ta[o&3](e,x,r);r=c[h>>2]|0;if(r|0?(h=r+4|0,e=c[h>>2]|0,c[h>>2]=e+-1,(e|0)==0):0){Pa[c[(c[r>>2]|0)+8>>2]&255](r);mi(r)}r=c[u>>2]|0;e=c[(c[r>>2]|0)+4>>2]|0;c[s>>2]=c[i>>2];i=s+4|0;h=c[A>>2]|0;c[i>>2]=h;if(h|0){o=h+4|0;c[o>>2]=(c[o>>2]|0)+1}Ta[e&3](r,x,s);s=c[i>>2]|0;if(s|0?(i=s+4|0,r=c[i>>2]|0,c[i>>2]=r+-1,(r|0)==0):0){Pa[c[(c[s>>2]|0)+8>>2]&255](s);mi(s)}s=c[u>>2]|0;u=c[(c[s>>2]|0)+4>>2]|0;c[t>>2]=c[v>>2];v=t+4|0;r=c[w>>2]|0;c[v>>2]=r;if(r|0){w=r+4|0;c[w>>2]=(c[w>>2]|0)+1}Ta[u&3](s,x,t);t=c[v>>2]|0;if(t|0?(v=t+4|0,x=c[v>>2]|0,c[v>>2]=x+-1,(x|0)==0):0){Pa[c[(c[t>>2]|0)+8>>2]&255](t);mi(t)}Pe(b);b=c[p>>2]|0;do if(b|0){p=b+4|0;t=c[p>>2]|0;c[p>>2]=t+-1;if(t|0)break;Pa[c[(c[b>>2]|0)+8>>2]&255](b);mi(b)}while(0);b=c[A>>2]|0;if(!b){Ia=d;return}A=b+4|0;t=c[A>>2]|0;c[A>>2]=t+-1;if(t|0){Ia=d;return}Pa[c[(c[b>>2]|0)+8>>2]&255](b);mi(b);Ia=d;return}function hb(b){b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0;d=Ia;Ia=Ia+208|0;if((Ia|0)>=(Ja|0))B(208);e=d+160|0;f=d+72|0;g=d+200|0;h=d+192|0;i=d+48|0;j=d+24|0;k=d;l=d+184|0;m=d+176|0;n=b+4|0;c[n>>2]=0;c[n+4>>2]=0;c[n+8>>2]=0;c[n+12>>2]=0;c[n+16>>2]=0;c[n+20>>2]=0;c[n+24>>2]=0;c[b>>2]=5232;n=b+32|0;o=b+36|0;p=b+40|0;q=b+68|0;r=n;s=r+36|0;do{c[r>>2]=0;r=r+4|0}while((r|0)<(s|0));c[q>>2]=1065353216;q=ni(328)|0;r=b+4|0;jb(q,r);c[g>>2]=q;s=ni(16)|0;c[s+4>>2]=0;c[s+8>>2]=0;c[s>>2]=4e3;c[s+12>>2]=q;t=g+4|0;c[t>>2]=s;c[e>>2]=q;c[e+4>>2]=q;zb(g,e);q=b+16|0;s=c[g>>2]|0;u=c[t>>2]|0;c[g>>2]=0;c[t>>2]=0;c[q>>2]=s;s=b+20|0;v=c[s>>2]|0;c[s>>2]=u;if(v|0?(u=v+4|0,s=c[u>>2]|0,c[u>>2]=s+-1,(s|0)==0):0){Pa[c[(c[v>>2]|0)+8>>2]&255](v);mi(v)}v=c[t>>2]|0;if(v|0?(t=v+4|0,s=c[t>>2]|0,c[t>>2]=s+-1,(s|0)==0):0){Pa[c[(c[v>>2]|0)+8>>2]&255](v);mi(v)}v=c[(c[q>>2]|0)+4>>2]|0;s=c[r>>2]|0;c[s+(v*48|0)+8>>2]=1065353216;c[s+(v*48|0)+12>>2]=1065353216;v=ni(464)|0;c[h>>2]=8;c[h+4>>2]=8;s=i+16|0;c[s>>2]=0;t=b;u=j+16|0;c[j>>2]=5252;c[j+4>>2]=t;c[u>>2]=j;w=k+16|0;c[k>>2]=5296;c[k+4>>2]=t;c[w>>2]=k;c[e>>2]=c[h>>2];c[e+4>>2]=c[h+4>>2];mb(v,r,e,0.0,i,j,k);c[g>>2]=v;h=ni(16)|0;c[h+4>>2]=0;c[h+8>>2]=0;c[h>>2]=4740;c[h+12>>2]=v;t=g+4|0;c[t>>2]=h;c[f>>2]=v;c[f+4>>2]=v;fe(g,f);v=c[g>>2]|0;h=c[t>>2]|0;c[g>>2]=0;c[t>>2]=0;c[n>>2]=v;v=c[o>>2]|0;c[o>>2]=h;if(v|0?(h=v+4|0,g=c[h>>2]|0,c[h>>2]=g+-1,(g|0)==0):0){Pa[c[(c[v>>2]|0)+8>>2]&255](v);mi(v)}v=c[t>>2]|0;if(v|0?(t=v+4|0,g=c[t>>2]|0,c[t>>2]=g+-1,(g|0)==0):0){Pa[c[(c[v>>2]|0)+8>>2]&255](v);mi(v)}v=c[w>>2]|0;if((k|0)!=(v|0)){if(v|0)Pa[c[(c[v>>2]|0)+20>>2]&255](v)}else Pa[c[(c[v>>2]|0)+16>>2]&255](v);v=c[u>>2]|0;if((j|0)!=(v|0)){if(v|0)Pa[c[(c[v>>2]|0)+20>>2]&255](v)}else Pa[c[(c[v>>2]|0)+16>>2]&255](v);v=c[s>>2]|0;if((i|0)!=(v|0)){if(v|0)Pa[c[(c[v>>2]|0)+20>>2]&255](v)}else Pa[c[(c[v>>2]|0)+16>>2]&255](v);v=c[(c[n>>2]|0)+4>>2]|0;i=c[r>>2]|0;c[i+(v*48|0)+8>>2]=1065353216;c[i+(v*48|0)+12>>2]=1065353216;v=c[(c[n>>2]|0)+4>>2]|0;i=c[r>>2]|0;c[i+(v*48|0)+24>>2]=0;c[i+(v*48|0)+28>>2]=1128792064;v=c[(c[n>>2]|0)+4>>2]|0;i=c[r>>2]|0;c[i+(v*48|0)+8>>2]=1063675494;c[i+(v*48|0)+12>>2]=0;v=c[(c[n>>2]|0)+4>>2]|0;i=c[r>>2]|0;c[i+(v*48|0)>>2]=1056964608;c[i+(v*48|0)+4>>2]=1056964608;v=c[n>>2]|0;c[v+8>>2]=1056964608;c[v+12>>2]=1056964608;v=f+4|0;c[v>>2]=0;c[v+4>>2]=0;a[f+11>>0]=3;a[f>>0]=a[15406]|0;a[f+1>>0]=a[15407]|0;a[f+2>>0]=a[15408]|0;a[f+3>>0]=0;v=f+12|0;i=f+16|0;c[i>>2]=0;c[i+4>>2]=0;a[v+11>>0]=3;a[v>>0]=a[15410]|0;a[v+1>>0]=a[15411]|0;a[v+2>>0]=a[15412]|0;a[v+3>>0]=0;v=f+24|0;c[v>>2]=0;c[v+4>>2]=0;c[v+8>>2]=0;a[v+11>>0]=5;a[v>>0]=a[15414]|0;a[v+1>>0]=a[15415]|0;a[v+2>>0]=a[15416]|0;a[v+3>>0]=a[15417]|0;a[v+4>>0]=a[15418]|0;a[v+5>>0]=0;v=f+36|0;c[v>>2]=0;c[v+4>>2]=0;c[v+8>>2]=0;a[v+11>>0]=4;c[v>>2]=1919252079;a[f+40>>0]=0;v=f+48|0;i=f+52|0;c[i>>2]=0;c[i+4>>2]=0;a[v+11>>0]=3;a[v>>0]=a[15406]|0;a[v+1>>0]=a[15407]|0;a[v+2>>0]=a[15408]|0;a[v+3>>0]=0;v=f+60|0;c[v>>2]=0;c[v+4>>2]=0;c[v+8>>2]=0;a[v+11>>0]=5;a[v>>0]=a[15420]|0;a[v+1>>0]=a[15421]|0;a[v+2>>0]=a[15422]|0;a[v+3>>0]=a[15423]|0;a[v+4>>0]=a[15424]|0;a[v+5>>0]=0;v=f+72|0;i=f+76|0;c[i>>2]=0;c[i+4>>2]=0;a[v+11>>0]=3;a[v>>0]=a[15410]|0;a[v+1>>0]=a[15411]|0;a[v+2>>0]=a[15412]|0;a[v+3>>0]=0;c[e>>2]=0;v=e+4|0;c[v>>2]=0;i=e+8|0;c[i>>2]=0;s=ni(84)|0;c[v>>2]=s;c[e>>2]=s;c[i>>2]=s+84;wi(s,f);wi(s+12|0,f+12|0);wi(s+24|0,f+24|0);wi(s+36|0,f+36|0);wi(s+48|0,f+48|0);wi(s+60|0,f+60|0);wi(s+72|0,f+72|0);c[v>>2]=s+84;i=f+72|0;if((a[i+11>>0]|0)<0)oi(c[i>>2]|0);i=f+60|0;if((a[i+11>>0]|0)<0)oi(c[i>>2]|0);i=f+48|0;if((a[i+11>>0]|0)<0)oi(c[i>>2]|0);i=f+36|0;if((a[i+11>>0]|0)<0)oi(c[i>>2]|0);i=f+24|0;if((a[i+11>>0]|0)<0)oi(c[i>>2]|0);i=f+12|0;if((a[i+11>>0]|0)<0)oi(c[i>>2]|0);if((a[f+11>>0]|0)<0)oi(c[f>>2]|0);f=b+52|0;i=b+44|0;j=b+48|0;b=l+4|0;u=0;k=s;do{s=k+(u*12|0)|0;if(!(Xb(f,s)|0)){w=c[i>>2]|0;g=(w-(c[p>>2]|0)|0)/12|0;t=w;if((c[j>>2]|0)==(t|0))wg(p,s);else{wi(t,s);c[i>>2]=(c[i>>2]|0)+12}c[(Wb(f,s)|0)>>2]=g}g=c[(Wb(f,s)|0)>>2]|0;me(l,c[n>>2]|0,r,0,u,g);g=c[b>>2]|0;if(g|0?(s=g+4|0,t=c[s>>2]|0,c[s>>2]=t+-1,(t|0)==0):0){Pa[c[(c[g>>2]|0)+8>>2]&255](g);mi(g)}u=u+1|0;k=c[e>>2]|0}while(u>>>0<(((c[v>>2]|0)-k|0)/12|0)>>>0);k=c[q>>2]|0;q=c[(c[k>>2]|0)+4>>2]|0;c[m>>2]=c[n>>2];n=m+4|0;u=c[o>>2]|0;c[n>>2]=u;if(u|0){o=u+4|0;c[o>>2]=(c[o>>2]|0)+1}Ta[q&3](k,r,m);m=c[n>>2]|0;if(m|0?(n=m+4|0,r=c[n>>2]|0,c[n>>2]=r+-1,(r|0)==0):0){Pa[c[(c[m>>2]|0)+8>>2]&255](m);mi(m)}m=c[e>>2]|0;if(!m){Ia=d;return}e=c[v>>2]|0;if((e|0)!=(m|0)){r=e;do{r=r+-12|0;if((a[r+11>>0]|0)<0)oi(c[r>>2]|0)}while((r|0)!=(m|0))}c[v>>2]=m;oi(m);Ia=d;return}function ib(a){a=a|0;ea(a|0)|0;oj()}function jb(d,e){d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0;f=Ia;Ia=Ia+48|0;if((Ia|0)>=(Ja|0))B(48);g=f;c[d>>2]=3976;h=d+4|0;i=e+4|0;j=c[i>>2]|0;k=(j-(c[e>>2]|0)|0)/48|0;l=d+8|0;c[l>>2]=0;c[l+4>>2]=0;c[l+8>>2]=0;c[l+12>>2]=0;c[l+16>>2]=0;c[l+20>>2]=0;c[d+32>>2]=255;l=d+36|0;c[d+88>>2]=0;c[d+112>>2]=0;c[d+136>>2]=0;a[d+144>>0]=0;a[d+145>>0]=0;c[d+168>>2]=0;c[d+192>>2]=0;c[d+216>>2]=0;a[d+224>>0]=0;c[d+248>>2]=0;c[d+272>>2]=0;c[d+296>>2]=0;m=d+304|0;c[l>>2]=0;c[l+4>>2]=0;c[l+8>>2]=0;c[l+12>>2]=0;c[l+16>>2]=0;c[l+20>>2]=0;c[l+24>>2]=0;b[l+28>>1]=0;c[m>>2]=0;c[m+4>>2]=0;c[m+8>>2]=0;c[m+12>>2]=0;c[m+16>>2]=0;c[h>>2]=k;m=g;l=m+40|0;do{c[m>>2]=0;m=m+4|0}while((m|0)<(l|0));c[g+44>>2]=1;c[g+32>>2]=k;c[g+40>>2]=1;if((c[e+8>>2]|0)>>>0>j>>>0){m=j;j=g;l=m+48|0;do{c[m>>2]=c[j>>2];m=m+4|0;j=j+4|0}while((m|0)<(l|0));j=(c[i>>2]|0)+48|0;c[i>>2]=j;n=j;o=c[e>>2]|0;p=n-o|0;q=(p|0)/48|0;r=q+-1|0;s=c[h>>2]|0;t=o;u=t+(s*48|0)+36|0;c[u>>2]=r;Ia=f;return}else{wb(e,g);n=c[i>>2]|0;o=c[e>>2]|0;p=n-o|0;q=(p|0)/48|0;r=q+-1|0;s=c[h>>2]|0;t=o;u=t+(s*48|0)+36|0;c[u>>2]=r;Ia=f;return}}function kb(b,d,e,g,h){b=b|0;d=d|0;e=e|0;g=g|0;h=+h;var i=0,j=0,k=0,l=0,m=0,n=0;i=Ia;Ia=Ia+48|0;if((Ia|0)>=(Ja|0))B(48);j=i;jb(b,d);c[b>>2]=4132;k=j+8|0;l=k+36|0;do{c[k>>2]=0;k=k+4|0}while((k|0)<(l|0));c[j+44>>2]=8;c[j>>2]=0;c[j+4>>2]=0;f[j+24>>2]=h;c[j+32>>2]=g;if(!(Xb(18324,e)|0)){g=c[4579]|0;m=(g-(c[4578]|0)|0)/12|0;n=g;if((c[4580]|0)==(n|0))Yb(18312,e);else{wi(n,e);c[4579]=(c[4579]|0)+12}c[(Wb(18324,e)|0)>>2]=m}c[j+36>>2]=c[(Wb(18324,e)|0)>>2];f[j+16>>2]=+U(((a[e+11>>0]|0)<0?c[e>>2]|0:e)|0,+h);f[j+20>>2]=h;e=d+4|0;m=c[e>>2]|0;n=c[d>>2]|0;c[n+((c[b+4>>2]|0)*48|0)+36>>2]=(m-n|0)/48|0;if((c[d+8>>2]|0)==(m|0)){Gb(d,j);Ia=i;return}else{k=m;m=j;l=k+48|0;do{c[k>>2]=c[m>>2];k=k+4|0;m=m+4|0}while((k|0)<(l|0));c[e>>2]=(c[e>>2]|0)+48;Ia=i;return}}function lb(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0;g=Ia;Ia=Ia+32|0;if((Ia|0)>=(Ja|0))B(32);h=g;i=b+152|0;j=c[d+16>>2]|0;do if(j)if((d|0)==(j|0)){k=h+16|0;c[k>>2]=h;Ra[c[(c[j>>2]|0)+12>>2]&31](j,h);l=k;break}else{k=h+16|0;c[k>>2]=La[c[(c[j>>2]|0)+8>>2]&63](j)|0;l=k;break}else{k=h+16|0;c[k>>2]=0;l=k}while(0);dc(h,i);i=c[l>>2]|0;if((h|0)!=(i|0)){if(i|0)Pa[c[(c[i>>2]|0)+20>>2]&255](i)}else Pa[c[(c[i>>2]|0)+16>>2]&255](i);i=b+176|0;l=c[e+16>>2]|0;do if(l)if((e|0)==(l|0)){j=h+16|0;c[j>>2]=h;Ra[c[(c[l>>2]|0)+12>>2]&31](l,h);m=j;break}else{j=h+16|0;c[j>>2]=La[c[(c[l>>2]|0)+8>>2]&63](l)|0;m=j;break}else{j=h+16|0;c[j>>2]=0;m=j}while(0);dc(h,i);i=c[m>>2]|0;if((h|0)!=(i|0)){if(i|0)Pa[c[(c[i>>2]|0)+20>>2]&255](i)}else Pa[c[(c[i>>2]|0)+16>>2]&255](i);i=b+200|0;m=c[f+16>>2]|0;do if(m)if((f|0)==(m|0)){l=h+16|0;c[l>>2]=h;Ra[c[(c[m>>2]|0)+12>>2]&31](m,h);n=l;break}else{l=h+16|0;c[l>>2]=La[c[(c[m>>2]|0)+8>>2]&63](m)|0;n=l;break}else{l=h+16|0;c[l>>2]=0;n=l}while(0);ec(h,i);i=c[n>>2]|0;if((h|0)==(i|0)){Pa[c[(c[i>>2]|0)+16>>2]&255](i);o=b+144|0;a[o>>0]=1;Ia=g;return}if(!i){o=b+144|0;a[o>>0]=1;Ia=g;return}Pa[c[(c[i>>2]|0)+20>>2]&255](i);o=b+144|0;a[o>>0]=1;Ia=g;return}function mb(b,d,e,g,h,i,j){b=b|0;d=d|0;e=e|0;g=+g;h=h|0;i=i|0;j=j|0;var k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,x=0,y=0,z=0,A=0,C=0,D=0,E=0,F=0,G=0.0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ba=0,ca=0,da=0,ea=0,fa=0.0,ga=0,ha=0,ia=0,ja=0,ka=0,la=0;k=Ia;Ia=Ia+112|0;if((Ia|0)>=(Ja|0))B(112);l=k+88|0;m=k+56|0;n=k+80|0;o=k+72|0;p=k+64|0;q=k+32|0;r=k;jb(b,d);c[b>>2]=4552;s=e;t=c[s>>2]|0;u=c[s+4>>2]|0;s=b+324|0;c[s>>2]=t;c[s+4>>2]=u;s=b+332|0;v=s;c[v>>2]=t;c[v+4>>2]=u;u=b+344|0;v=h+16|0;x=c[v>>2]|0;do if(x)if((h|0)==(x|0)){c[b+360>>2]=u;y=c[v>>2]|0;Ra[c[(c[y>>2]|0)+12>>2]&31](y,u);break}else{c[b+360>>2]=La[c[(c[x>>2]|0)+8>>2]&63](x)|0;break}else c[b+360>>2]=0;while(0);x=b+368|0;u=i+16|0;h=c[u>>2]|0;do if(h)if((i|0)==(h|0)){c[b+384>>2]=x;y=c[u>>2]|0;Ra[c[(c[y>>2]|0)+12>>2]&31](y,x);break}else{c[b+384>>2]=La[c[(c[h>>2]|0)+8>>2]&63](h)|0;break}else c[b+384>>2]=0;while(0);h=b+392|0;x=j+16|0;y=c[x>>2]|0;do if(y)if((j|0)==(y|0)){c[b+408>>2]=h;z=c[x>>2]|0;Ra[c[(c[z>>2]|0)+12>>2]&31](z,h);break}else{c[b+408>>2]=La[c[(c[y>>2]|0)+8>>2]&63](y)|0;break}else c[b+408>>2]=0;while(0);y=b+416|0;h=b+420|0;x=b+424|0;j=b+428|0;z=b+432|0;c[y>>2]=0;c[y+4>>2]=0;c[y+8>>2]=0;c[y+12>>2]=0;c[y+16>>2]=0;f[b+436>>2]=g;A=b+440|0;C=b+444|0;D=c[s>>2]|0;s=c[b+336>>2]|0;E=b+448|0;f[E>>2]=g/+(D+1|0);F=b+452|0;f[F>>2]=g/+(s+1|0);a[b+456>>0]=0;G=1.0-g;f[A>>2]=G/+(D|0);f[C>>2]=G/+(s|0);s=e+4|0;D=c[s>>2]|0;a:do if((D|0)>0){H=l+4|0;I=l+8|0;J=l+4|0;K=l+4|0;L=b+440|0;M=p+4|0;N=0;O=t;P=0;Q=0;R=t;S=t;while(1){c[l>>2]=0;c[H>>2]=0;c[I>>2]=0;if(P>>>0>=Q>>>0){Ad(x,l);T=c[l>>2]|0;if(!T){U=O;V=S;W=R}else{X=c[H>>2]|0;if((X|0)==(T|0)){Y=O;Z=T}else{_=X;do{X=c[_+-4>>2]|0;_=_+-8|0;if(X|0?($=X+4|0,aa=c[$>>2]|0,c[$>>2]=aa+-1,(aa|0)==0):0){Pa[c[(c[X>>2]|0)+8>>2]&255](X);mi(X)}}while((_|0)!=(T|0));Y=c[e>>2]|0;Z=c[l>>2]|0}c[H>>2]=T;oi(Z);U=Y;V=Y;W=Y}}else{c[P>>2]=0;_=P+4|0;c[_>>2]=0;X=P+8|0;c[X>>2]=0;c[P>>2]=c[l>>2];c[_>>2]=c[H>>2];c[X>>2]=c[I>>2];c[I>>2]=0;c[H>>2]=0;c[l>>2]=0;c[j>>2]=(c[j>>2]|0)+12;U=O;V=S;W=R}if((V|0)>0){G=+(N|0);X=N+1|0;g=+(X|0);_=0;while(1){aa=c[x>>2]|0;c[l>>2]=0;c[J>>2]=0;$=aa+(N*12|0)+4|0;ba=c[$>>2]|0;if(ba>>>0>=(c[aa+(N*12|0)+8>>2]|0)>>>0){Bd(aa+(N*12|0)|0,l);aa=c[J>>2]|0;if(aa|0?(ca=aa+4|0,da=c[ca>>2]|0,c[ca>>2]=da+-1,(da|0)==0):0){Pa[c[(c[aa>>2]|0)+8>>2]&255](aa);mi(aa)}}else{c[ba>>2]=0;c[ba+4>>2]=0;c[l>>2]=0;c[J>>2]=0;c[$>>2]=ba+8}ba=c[v>>2]|0;if(!ba)ea=_+1|0;else{$=La[c[(c[ba>>2]|0)+24>>2]&63](ba)|0;c[l>>2]=$;ba=ni(16)|0;c[ba+4>>2]=0;c[ba+8>>2]=0;c[ba>>2]=4e3;c[ba+12>>2]=$;c[K>>2]=ba;c[m>>2]=$;c[m+4>>2]=$;zb(l,m);$=c[C>>2]|0;ba=(c[l>>2]|0)+4|0;aa=c[ba>>2]|0;da=c[d>>2]|0;c[da+(aa*48|0)+8>>2]=c[A>>2];c[da+(aa*48|0)+12>>2]=$;$=_+1|0;fa=+f[C>>2]*G+ +f[F>>2]*g;aa=c[ba>>2]|0;ba=c[d>>2]|0;f[ba+(aa*48|0)>>2]=+f[L>>2]*+(_|0)+ +f[E>>2]*+($|0);f[ba+(aa*48|0)+4>>2]=fa;aa=c[l>>2]|0;ba=aa+4|0;da=c[ba>>2]|0;ca=c[d>>2]|0;c[ca+(da*48|0)+16>>2]=1065353216;c[ca+(da*48|0)+20>>2]=1065353216;da=c[ba>>2]|0;ba=c[d>>2]|0;c[ba+(da*48|0)+24>>2]=-1073741824;c[ba+(da*48|0)+28>>2]=-1073741824;da=c[(c[b>>2]|0)+4>>2]|0;c[p>>2]=aa;aa=c[K>>2]|0;c[M>>2]=aa;if(aa|0){ba=aa+4|0;c[ba>>2]=(c[ba>>2]|0)+1}Ta[da&3](b,d,p);da=c[M>>2]|0;if(da|0?(ba=da+4|0,aa=c[ba>>2]|0,c[ba>>2]=aa+-1,(aa|0)==0):0){Pa[c[(c[da>>2]|0)+8>>2]&255](da);mi(da)}da=c[K>>2]|0;if(da|0?(aa=da+4|0,ba=c[aa>>2]|0,c[aa>>2]=ba+-1,(ba|0)==0):0){Pa[c[(c[da>>2]|0)+8>>2]&255](da);mi(da)}ea=$}$=c[e>>2]|0;if((ea|0)<($|0))_=ea;else{ga=X;ha=$;ia=$;ja=$;break}}}else{ga=N+1|0;ha=U;ia=W;ja=V}X=c[s>>2]|0;if((ga|0)>=(X|0)){ka=X;la=ia;break a}N=ga;O=ha;P=c[j>>2]|0;Q=c[z>>2]|0;R=ia;S=ja}}else{ka=D;la=t}while(0);t=ni(12)|0;D=w(ka<<1,la)|0;c[r>>2]=d;la=r+8|0;ka=c[u>>2]|0;do if(ka)if((i|0)==(ka|0)){c[r+24>>2]=la;Ra[c[(c[ka>>2]|0)+12>>2]&31](ka,la);break}else{c[r+24>>2]=La[c[(c[ka>>2]|0)+8>>2]&63](ka)|0;break}else c[r+24>>2]=0;while(0);ka=q+16|0;c[ka>>2]=0;la=ni(40)|0;c[la>>2]=4604;c[la+8>>2]=c[r>>2];i=la+16|0;u=r+24|0;ja=c[u>>2]|0;do if(ja)if((r+8|0)==(ja|0)){c[la+32>>2]=i;Ra[c[(c[ja>>2]|0)+12>>2]&31](ja,i);break}else{c[la+32>>2]=ja;c[u>>2]=0;break}else c[la+32>>2]=0;while(0);c[ka>>2]=la;zd(t,d,D,b,q);c[o>>2]=0;c[l>>2]=c[o>>2];Cd(n,t,l);l=c[n>>2]|0;c[n>>2]=c[y>>2];c[y>>2]=l;l=n+4|0;n=c[l>>2]|0;y=c[h>>2]|0;c[l>>2]=y;c[h>>2]=n;n=y;if(y|0?(h=n+4|0,l=c[h>>2]|0,c[h>>2]=l+-1,(l|0)==0):0){Pa[c[(c[y>>2]|0)+8>>2]&255](n);mi(n)}n=c[ka>>2]|0;if((q|0)!=(n|0)){if(n|0)Pa[c[(c[n>>2]|0)+20>>2]&255](n)}else Pa[c[(c[n>>2]|0)+16>>2]&255](n);n=c[u>>2]|0;if((r+8|0)==(n|0)){Pa[c[(c[n>>2]|0)+16>>2]&255](n);Ia=k;return}if(!n){Ia=k;return}Pa[c[(c[n>>2]|0)+20>>2]&255](n);Ia=k;return}function nb(b,d){b=b|0;d=d|0;var e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0.0,r=0.0,s=0,t=0,u=0,v=0,x=0,y=0,z=0.0,A=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0.0,Z=0.0,_=0,$=0.0,aa=0.0,ba=0.0,ca=0.0,da=0,ea=0,fa=0,ga=0,ha=0,ia=0,ja=0,ka=0;e=Ia;Ia=Ia+80|0;if((Ia|0)>=(Ja|0))B(80);g=e+72|0;h=e+48|0;i=e+24|0;j=e;k=b+56|0;l=c[k>>2]|0;m=b+4|0;oe(l,m);n=d;o=c[n>>2]|0;p=c[n+4>>2]|0;n=l+332|0;c[n>>2]=o;c[n+4>>2]=p;q=+f[l+436>>2];r=1.0-q;f[l+440>>2]=r/+(o|0);f[l+444>>2]=r/+(p|0);f[l+448>>2]=q/+(o+1|0);f[l+452>>2]=q/+(p+1|0);f[(c[b+32>>2]|0)+52>>2]=+(c[d>>2]|0)/+(c[d+4>>2]|0);p=c[k>>2]|0;l=c[p+332>>2]|0;q=+(l+-1|0);o=c[p+336>>2]|0;r=+(o+-1|0);if((o|0)<=0){s=p;t=c[s>>2]|0;u=t+8|0;v=c[u>>2]|0;x=s+44|0;y=s+36|0;Ua[v&15](s,m,x,y);Ia=e;return}z=q*r;o=d+16|0;n=d+32|0;A=d+48|0;C=d+64|0;D=d+20|0;E=d+36|0;F=d+52|0;G=d+68|0;H=d+24|0;I=d+40|0;J=d+56|0;K=d+72|0;L=d+12|0;M=d+8|0;d=g+4|0;N=h+16|0;O=b;b=i+16|0;P=i+4|0;Q=i+8|0;R=i+12|0;S=j+16|0;T=j+4|0;U=j+8|0;V=j+12|0;W=0;X=p;p=l;while(1){if((p|0)>0){Y=+(W|0);Z=r-Y;l=0;_=X;while(1){$=+(l|0);aa=q-$;ba=Z*aa/z;ca=Z*$/z;$=aa*Y/z;aa=+(w(l,W)|0)/z;me(g,_,m,W,l,(~~(ba*+((c[D>>2]|0)>>>0)+ca*+((c[E>>2]|0)>>>0)+$*+((c[F>>2]|0)>>>0)+aa*+((c[G>>2]|0)>>>0))>>>0<<16)+(~~(ba*+((c[o>>2]|0)>>>0)+ca*+((c[n>>2]|0)>>>0)+$*+((c[A>>2]|0)>>>0)+aa*+((c[C>>2]|0)>>>0))>>>0<<24)+(~~(ba*+((c[H>>2]|0)>>>0)+ca*+((c[I>>2]|0)>>>0)+$*+((c[J>>2]|0)>>>0)+aa*+((c[K>>2]|0)>>>0))>>>0<<8)|255);if(((W|0)%(c[L>>2]|0)|0|0)==0?((l|0)%(c[M>>2]|0)|0|0)==0:0){da=c[g>>2]|0;ea=da+88|0;fa=c[ea>>2]|0;if((da+72|0)!=(fa|0)){if(fa|0)Pa[c[(c[fa>>2]|0)+20>>2]&255](fa)}else Pa[c[(c[fa>>2]|0)+16>>2]&255](fa);c[ea>>2]=0;ea=da+112|0;fa=c[ea>>2]|0;if((da+96|0)!=(fa|0)){if(fa|0)Pa[c[(c[fa>>2]|0)+20>>2]&255](fa)}else Pa[c[(c[fa>>2]|0)+16>>2]&255](fa);c[ea>>2]=0;ea=da+136|0;fa=c[ea>>2]|0;if((da+120|0)!=(fa|0)){if(fa|0)Pa[c[(c[fa>>2]|0)+20>>2]&255](fa)}else Pa[c[(c[fa>>2]|0)+16>>2]&255](fa);c[ea>>2]=0;a[da+64>>0]=0}else ga=9;do if((ga|0)==9){ga=0;da=c[g>>2]|0;c[N>>2]=0;ea=da;fa=c[d>>2]|0;if(!fa)ha=0;else{ia=fa+4|0;c[ia>>2]=(c[ia>>2]|0)+1;ha=c[d>>2]|0}c[i>>2]=4768;c[P>>2]=O;c[Q>>2]=ea;c[R>>2]=fa;c[b>>2]=i;if(ha|0){fa=ha+4|0;c[fa>>2]=(c[fa>>2]|0)+1}c[j>>2]=4812;c[T>>2]=O;c[U>>2]=ea;c[V>>2]=ha;c[S>>2]=j;ne(da,h,i,j);da=c[S>>2]|0;if((j|0)!=(da|0)){if(da|0)Pa[c[(c[da>>2]|0)+20>>2]&255](da)}else Pa[c[(c[da>>2]|0)+16>>2]&255](da);da=c[b>>2]|0;if((i|0)!=(da|0)){if(da|0)Pa[c[(c[da>>2]|0)+20>>2]&255](da)}else Pa[c[(c[da>>2]|0)+16>>2]&255](da);da=c[N>>2]|0;if((h|0)==(da|0)){Pa[c[(c[da>>2]|0)+16>>2]&255](da);break}if(da|0)Pa[c[(c[da>>2]|0)+20>>2]&255](da)}while(0);da=c[d>>2]|0;if(da|0?(ea=da+4|0,fa=c[ea>>2]|0,c[ea>>2]=fa+-1,(fa|0)==0):0){Pa[c[(c[da>>2]|0)+8>>2]&255](da);mi(da)}l=l+1|0;da=c[k>>2]|0;fa=c[da+332>>2]|0;if((l|0)>=(fa|0)){ja=fa;ka=da;break}else _=da}}else{ja=p;ka=X}W=W+1|0;if((W|0)>=(c[ka+336>>2]|0)){s=ka;break}else{X=ka;p=ja}}t=c[s>>2]|0;u=t+8|0;v=c[u>>2]|0;x=s+44|0;y=s+36|0;Ua[v&15](s,m,x,y);Ia=e;return}function ob(a,b,c){a=a|0;b=+b;c=c|0;return}function pb(a,b){a=a|0;b=b|0;return}function qb(a,b){a=a|0;b=b|0;return}function rb(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;d=a+4|0;e=c[a>>2]|0;f=(c[d>>2]|0)-e|0;g=(f|0)/80|0;h=g+1|0;if(h>>>0>53687091)Si(a);i=a+8|0;j=((c[i>>2]|0)-e|0)/80|0;k=j<<1;l=j>>>0<26843545?(k>>>0<h>>>0?h:k):53687091;do if(l)if(l>>>0>53687091){k=da(8)|0;ti(k,10959);c[k>>2]=6220;ha(k|0,3864,124)}else{m=ni(l*80|0)|0;break}else m=0;while(0);k=m+(g*80|0)|0;g=m+(l*80|0)|0;l=k;m=b;b=l+80|0;do{c[l>>2]=c[m>>2];l=l+4|0;m=m+4|0}while((l|0)<(b|0));m=k+(((f|0)/-80|0)*80|0)|0;if((f|0)>0)Tj(m|0,e|0,f|0)|0;c[a>>2]=m;c[d>>2]=k+80;c[i>>2]=g;if(!e)return;oi(e);return}function sb(a,b,d){a=a|0;b=b|0;d=d|0;c[a+56>>2]=d;return}function tb(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0;e=c[d>>2]|0;f=c[b>>2]|0;c[f+((c[a+4>>2]|0)*48|0)+36>>2]=c[f+((c[e+4>>2]|0)*48|0)+36>>2];f=a+316|0;b=c[f>>2]|0;if((b|0)==(c[a+320>>2]|0)){xb(a+312|0,d);return}c[b>>2]=e;e=c[d+4>>2]|0;c[b+4>>2]=e;if(!e)g=b;else{b=e+4|0;c[b>>2]=(c[b>>2]|0)+1;g=c[f>>2]|0}c[f>>2]=g+8;return}function ub(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var g=0,h=0,i=0,j=0,k=0,l=0.0,m=0.0,n=0,o=0,p=0.0,q=0.0,r=0.0,s=0.0;g=Ia;Ia=Ia+16|0;if((Ia|0)>=(Ja|0))B(16);h=g;i=d;j=c[i+4>>2]|0;k=a+44|0;c[k>>2]=c[i>>2];c[k+4>>2]=j;j=e;k=c[j+4>>2]|0;i=a+36|0;c[i>>2]=c[j>>2];c[i+4>>2]=k;k=c[a+4>>2]|0;i=c[b>>2]|0;l=+f[i+(k*48|0)+8>>2]*+f[e>>2]+ +f[i+(k*48|0)+24>>2];j=e+4|0;m=+f[i+(k*48|0)+12>>2]*+f[j>>2]+ +f[i+(k*48|0)+28>>2];n=a+24|0;f[n>>2]=l;o=a+28|0;f[o>>2]=m;do if((c[a+56>>2]|0)==1){p=+f[a+52>>2];q=m*p;if(q<l){f[n>>2]=q;r=q;s=m;break}else{q=l/p;f[o>>2]=q;r=l;s=q;break}}else{r=l;s=m}while(0);m=+f[i+(k*48|0)+20>>2]+(+f[d+4>>2]+ +f[j>>2]*+f[i+(k*48|0)+4>>2]-s*+f[a+12>>2]);f[a+16>>2]=+f[i+(k*48|0)+16>>2]+(+f[d>>2]+ +f[e>>2]*+f[i+(k*48|0)>>2]-r*+f[a+8>>2]);f[a+20>>2]=m;yb(h,a,b);Ia=g;return}function vb(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;return}function wb(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;d=a+4|0;e=c[a>>2]|0;f=(c[d>>2]|0)-e|0;g=(f|0)/48|0;h=g+1|0;if(h>>>0>89478485)Si(a);i=a+8|0;j=((c[i>>2]|0)-e|0)/48|0;k=j<<1;l=j>>>0<44739242?(k>>>0<h>>>0?h:k):89478485;do if(l)if(l>>>0>89478485){k=da(8)|0;ti(k,10959);c[k>>2]=6220;ha(k|0,3864,124)}else{m=ni(l*48|0)|0;break}else m=0;while(0);k=m+(g*48|0)|0;g=m+(l*48|0)|0;l=k;m=b;b=l+48|0;do{c[l>>2]=c[m>>2];l=l+4|0;m=m+4|0}while((l|0)<(b|0));m=k+(((f|0)/-48|0)*48|0)|0;if((f|0)>0)Tj(m|0,e|0,f|0)|0;c[a>>2]=m;c[d>>2]=k+48;c[i>>2]=g;if(!e)return;oi(e);return}function xb(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0;d=a+4|0;e=c[d>>2]|0;f=c[a>>2]|0;g=e-f>>3;h=g+1|0;i=f;j=e;if(h>>>0>536870911)Si(a);e=a+8|0;k=(c[e>>2]|0)-f|0;f=k>>2;l=k>>3>>>0<268435455?(f>>>0<h>>>0?h:f):536870911;do if(l)if(l>>>0>536870911){f=da(8)|0;ti(f,10959);c[f>>2]=6220;ha(f|0,3864,124)}else{m=ni(l<<3)|0;break}else m=0;while(0);f=m+(g<<3)|0;h=m+(l<<3)|0;c[f>>2]=c[b>>2];l=c[b+4>>2]|0;c[m+(g<<3)+4>>2]=l;if(!l){n=i;o=j}else{j=l+4|0;c[j>>2]=(c[j>>2]|0)+1;n=c[a>>2]|0;o=c[d>>2]|0}j=f+8|0;l=n;if((o|0)==(n|0)){p=f;q=l;r=o}else{i=g+-1-((o+-8-l|0)>>>3)|0;l=o;o=f;do{f=o;o=o+-8|0;g=l;l=l+-8|0;c[o>>2]=c[l>>2];b=g+-4|0;c[f+-4>>2]=c[b>>2];c[l>>2]=0;c[b>>2]=0}while((l|0)!=(n|0));p=m+(i<<3)|0;q=c[a>>2]|0;r=c[d>>2]|0}c[a>>2]=p;c[d>>2]=j;c[e>>2]=h;h=q;if((r|0)!=(h|0)){e=r;do{r=c[e+-4>>2]|0;e=e+-8|0;if(r|0?(j=r+4|0,d=c[j>>2]|0,c[j>>2]=d+-1,(d|0)==0):0){Pa[c[(c[r>>2]|0)+8>>2]&255](r);mi(r)}}while((e|0)!=(h|0))}if(!q)return;oi(q);return}function yb(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,C=0,D=0,E=0,F=0.0,G=0.0,H=0.0;e=Ia;Ia=Ia+32|0;if((Ia|0)>=(Ja|0))B(32);g=e+20|0;h=e+16|0;i=e+12|0;j=e+8|0;k=e;c[g>>2]=0;c[h>>2]=0;c[i>>2]=0;c[j>>2]=0;l=b+16|0;m=l;n=c[m+4>>2]|0;o=k;c[o>>2]=c[m>>2];c[o+4>>2]=n;n=c[b+312>>2]|0;o=c[b+316>>2]|0;if((n|0)==(o|0)){p=0;q=0;r=0;s=0;c[a>>2]=q;t=a+4|0;c[t>>2]=s;u=a+8|0;c[u>>2]=p;v=a+12|0;c[v>>2]=r;Ia=e;return}m=b+60|0;w=b+24|0;b=k+4|0;x=n;do{n=c[x>>2]|0;y=c[x+4>>2]|0;z=(y|0)==0;if(!z){A=y+4|0;c[A>>2]=(c[A>>2]|0)+1}A=c[m>>2]|0;do if((A|0)!=2){C=n;D=c[(c[n>>2]|0)+8>>2]|0;if((A|0)==1){Ua[D&15](C,d,k,w);f[k>>2]=+f[C+16>>2]+ +f[C+24>>2];E=C;break}else{Ua[D&15](C,d,l,w);E=C;break}}else{C=n;Ua[c[(c[n>>2]|0)+8>>2]&15](C,d,k,w);f[b>>2]=+f[C+20>>2]+ +f[C+28>>2];E=C}while(0);F=+f[E+16>>2];G=+f[g>>2];f[g>>2]=F<G?F:G;G=+f[E+20>>2];H=+f[h>>2];f[h>>2]=G<H?G:H;H=F+ +f[E+24>>2];F=+f[i>>2];f[i>>2]=F<H?H:F;F=G+ +f[E+28>>2];G=+f[j>>2];f[j>>2]=G<F?F:G;if(!z?(n=y+4|0,A=c[n>>2]|0,c[n>>2]=A+-1,(A|0)==0):0){Pa[c[(c[y>>2]|0)+8>>2]&255](y);mi(y)}x=x+8|0}while((x|0)!=(o|0));p=c[i>>2]|0;q=c[g>>2]|0;r=c[j>>2]|0;s=c[h>>2]|0;c[a>>2]=q;t=a+4|0;c[t>>2]=s;u=a+8|0;c[u>>2]=p;v=a+12|0;c[v>>2]=r;Ia=e;return}function zb(a,b){a=a|0;b=b|0;return}function Ab(a){a=a|0;li(a);oi(a);return}function Bb(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;od(b);oi(b);return}function Cb(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==11161?a+12|0:0)|0}function Db(a){a=a|0;oi(a);return}function Eb(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0.0,o=0.0,p=0,q=0,r=0.0,s=0.0,t=0.0,u=0.0;g=Ia;Ia=Ia+32|0;if((Ia|0)>=(Ja|0))B(32);h=g+8|0;i=g;j=g+16|0;k=a+24|0;l=c[k+4>>2]|0;m=h;c[m>>2]=c[k>>2];c[m+4>>2]=l;l=a+16|0;m=c[l+4>>2]|0;k=i;c[k>>2]=c[l>>2];c[k+4>>2]=m;m=d;k=c[m+4>>2]|0;l=a+44|0;c[l>>2]=c[m>>2];c[l+4>>2]=k;k=e;l=c[k+4>>2]|0;m=a+36|0;c[m>>2]=c[k>>2];c[m+4>>2]=l;l=c[a+4>>2]|0;m=c[b>>2]|0;n=+f[m+(l*48|0)+8>>2]*+f[e>>2]+ +f[m+(l*48|0)+24>>2];k=e+4|0;o=+f[m+(l*48|0)+12>>2]*+f[k>>2]+ +f[m+(l*48|0)+28>>2];p=a+24|0;f[p>>2]=n;q=a+28|0;f[q>>2]=o;do if((c[a+56>>2]|0)==1){r=+f[a+52>>2];s=o*r;if(s<n){f[p>>2]=s;t=o;u=s;break}else{s=n/r;f[q>>2]=s;t=s;u=n;break}}else{t=o;u=n}while(0);n=+f[m+(l*48|0)+20>>2]+(+f[d+4>>2]+ +f[k>>2]*+f[m+(l*48|0)+4>>2]-t*+f[a+12>>2]);f[a+16>>2]=+f[m+(l*48|0)+16>>2]+(+f[d>>2]+ +f[e>>2]*+f[m+(l*48|0)>>2]-u*+f[a+8>>2]);f[a+20>>2]=n;Ua[c[(c[a>>2]|0)+12>>2]&15](a,b,i,h);yb(j,a,b);Ia=g;return}function Fb(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0;e=c[b>>2]|0;b=(c[e+((c[a+4>>2]|0)*48|0)+32>>2]|0)+1|0;d=a+16|0;f=c[d+4>>2]|0;g=e+(b*48|0)|0;c[g>>2]=c[d>>2];c[g+4>>2]=f;f=a+24|0;a=c[f+4>>2]|0;g=e+(b*48|0)+16|0;c[g>>2]=c[f>>2];c[g+4>>2]=a;return}function Gb(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;d=a+4|0;e=c[a>>2]|0;f=(c[d>>2]|0)-e|0;g=(f|0)/48|0;h=g+1|0;if(h>>>0>89478485)Si(a);i=a+8|0;j=((c[i>>2]|0)-e|0)/48|0;k=j<<1;l=j>>>0<44739242?(k>>>0<h>>>0?h:k):89478485;do if(l)if(l>>>0>89478485){k=da(8)|0;ti(k,10959);c[k>>2]=6220;ha(k|0,3864,124)}else{m=ni(l*48|0)|0;break}else m=0;while(0);k=m+(g*48|0)|0;g=m+(l*48|0)|0;l=k;m=b;b=l+48|0;do{c[l>>2]=c[m>>2];l=l+4|0;m=m+4|0}while((l|0)<(b|0));m=k+(((f|0)/-48|0)*48|0)|0;if((f|0)>0)Tj(m|0,e|0,f|0)|0;c[a>>2]=m;c[d>>2]=k+48;c[i>>2]=g;if(!e)return;oi(e);return}function Hb(a,b){a=a|0;b=b|0;return}function Ib(a){a=a|0;li(a);oi(a);return}function Jb(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;od(b);oi(b);return}function Kb(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==11345?a+12|0:0)|0}function Lb(a){a=a|0;oi(a);return}function Mb(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0.0,p=0.0,q=0,r=0,s=0,t=0.0,u=0.0,v=0.0,w=0.0,x=0,y=0,z=0;g=Ia;Ia=Ia+32|0;if((Ia|0)>=(Ja|0))B(32);h=g+8|0;i=g;j=g+16|0;k=a+24|0;l=k;m=c[l+4>>2]|0;n=h;c[n>>2]=c[l>>2];c[n+4>>2]=m;m=a+16|0;n=c[m+4>>2]|0;l=i;c[l>>2]=c[m>>2];c[l+4>>2]=n;n=d;l=c[n+4>>2]|0;m=a+44|0;c[m>>2]=c[n>>2];c[m+4>>2]=l;l=e;m=c[l+4>>2]|0;n=a+36|0;c[n>>2]=c[l>>2];c[n+4>>2]=m;m=c[a+4>>2]|0;n=c[b>>2]|0;o=+f[n+(m*48|0)+8>>2]*+f[e>>2]+ +f[n+(m*48|0)+24>>2];l=e+4|0;p=+f[n+(m*48|0)+12>>2]*+f[l>>2]+ +f[n+(m*48|0)+28>>2];q=a+24|0;f[q>>2]=o;r=a+28|0;f[r>>2]=p;s=a+56|0;do if((c[s>>2]|0)==1){t=+f[a+52>>2];u=p*t;if(u<o){f[q>>2]=u;v=p;w=u;break}else{u=o/t;f[r>>2]=u;v=u;w=o;break}}else{v=p;w=o}while(0);o=+f[n+(m*48|0)+20>>2]+(+f[d+4>>2]+ +f[l>>2]*+f[n+(m*48|0)+4>>2]-v*+f[a+12>>2]);f[a+16>>2]=+f[n+(m*48|0)+16>>2]+(+f[d>>2]+ +f[e>>2]*+f[n+(m*48|0)>>2]-w*+f[a+8>>2]);f[a+20>>2]=o;yb(j,a,b);if((c[s>>2]|0)!=3){x=c[a>>2]|0;y=x+12|0;z=c[y>>2]|0;Ua[z&15](a,b,i,h);Ia=g;return}f[k>>2]=+f[j+8>>2]-+f[j>>2];x=c[a>>2]|0;y=x+12|0;z=c[y>>2]|0;Ua[z&15](a,b,i,h);Ia=g;return}function Nb(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0;e=c[b>>2]|0;b=(c[e+((c[a+4>>2]|0)*48|0)+32>>2]|0)+1|0;d=a+16|0;f=c[d+4>>2]|0;g=e+(b*48|0)|0;c[g>>2]=c[d>>2];c[g+4>>2]=f;f=a+24|0;a=c[f+4>>2]|0;g=e+(b*48|0)+16|0;c[g>>2]=c[f>>2];c[g+4>>2]=a;return}function Ob(a,b){a=a|0;b=b|0;return}function Pb(a){a=a|0;li(a);oi(a);return}function Qb(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;od(b);oi(b);return}function Rb(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==11529?a+12|0:0)|0}function Sb(a){a=a|0;oi(a);return}function Tb(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;c[a+56>>2]=d;if((d|0)!=2)return;d=c[a+4>>2]|0;a=c[b>>2]|0;b=a+(((c[a+(d*48|0)+32>>2]|0)+1|0)*48|0)+16|0;e=c[b+4>>2]|0;f=a+(d*48|0)+24|0;c[f>>2]=c[b>>2];c[f+4>>2]=e;return}function Ub(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0.0,o=0.0,p=0,q=0,r=0.0,s=0.0,t=0.0,u=0.0;g=Ia;Ia=Ia+32|0;if((Ia|0)>=(Ja|0))B(32);h=g+8|0;i=g;j=g+16|0;k=a+24|0;l=c[k+4>>2]|0;m=h;c[m>>2]=c[k>>2];c[m+4>>2]=l;l=a+16|0;m=c[l+4>>2]|0;k=i;c[k>>2]=c[l>>2];c[k+4>>2]=m;m=d;k=c[m+4>>2]|0;l=a+44|0;c[l>>2]=c[m>>2];c[l+4>>2]=k;k=e;l=c[k+4>>2]|0;m=a+36|0;c[m>>2]=c[k>>2];c[m+4>>2]=l;l=c[a+4>>2]|0;m=c[b>>2]|0;n=+f[m+(l*48|0)+8>>2]*+f[e>>2]+ +f[m+(l*48|0)+24>>2];k=e+4|0;o=+f[m+(l*48|0)+12>>2]*+f[k>>2]+ +f[m+(l*48|0)+28>>2];p=a+24|0;f[p>>2]=n;q=a+28|0;f[q>>2]=o;do if((c[a+56>>2]|0)==1){r=+f[a+52>>2];s=o*r;if(s<n){f[p>>2]=s;t=o;u=s;break}else{s=n/r;f[q>>2]=s;t=s;u=n;break}}else{t=o;u=n}while(0);n=+f[m+(l*48|0)+20>>2]+(+f[d+4>>2]+ +f[k>>2]*+f[m+(l*48|0)+4>>2]-t*+f[a+12>>2]);f[a+16>>2]=+f[m+(l*48|0)+16>>2]+(+f[d>>2]+ +f[e>>2]*+f[m+(l*48|0)>>2]-u*+f[a+8>>2]);f[a+20>>2]=n;Ua[c[(c[a>>2]|0)+12>>2]&15](a,b,i,h);yb(j,a,b);Ia=g;return}function Vb(b,d,e,g){b=b|0;d=d|0;e=e|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0.0,o=0.0,p=0,q=0.0,r=0.0,s=0,t=0,u=0,v=0;g=b+4|0;e=c[g>>2]|0;h=c[d>>2]|0;i=(c[h+(e*48|0)+32>>2]|0)+1|0;j=h+(i*48|0)|0;switch(c[b+56>>2]|0){case 3:case 0:{k=h+(i*48|0)+36|0;l=(c[4578]|0)+((c[k>>2]|0)*12|0)|0;m=h+(i*48|0)+24|0;n=+f[m>>2];o=n==0.0?10.0:n;if((a[l+11>>0]|0)<0)p=c[l>>2]|0;else p=l;n=+U(p|0,+o);q=+f[b+24>>2];if(q<=.1)return;r=o*(q/n);p=(c[4578]|0)+((c[k>>2]|0)*12|0)|0;f[m>>2]=r;if((a[p+11>>0]|0)<0)s=c[p>>2]|0;else s=p;f[h+(i*48|0)+16>>2]=+U(s|0,+r);f[h+(i*48|0)+20>>2]=r;switch(c[h+(i*48|0)+44>>2]|0){case 8:case 2:case 3:case 4:case 7:break;default:return}n=+f[b+20>>2]+(+f[b+28>>2]-r)*+f[b+12>>2];c[j>>2]=c[b+16>>2];f[h+(i*48|0)+4>>2]=n;return}case 2:{switch(c[h+(i*48|0)+44>>2]|0){case 8:case 2:case 3:case 4:case 7:{s=b+16|0;b=c[s+4>>2]|0;p=j;c[p>>2]=c[s>>2];c[p+4>>2]=b;b=c[g>>2]|0;g=c[d>>2]|0;t=(c[g+(b*48|0)+32>>2]|0)+1|0;u=g;v=b;break}default:{t=i;u=h;v=e}}e=u+(t*48|0)+16|0;t=c[e+4>>2]|0;h=u+(v*48|0)+24|0;c[h>>2]=c[e>>2];c[h+4>>2]=t;return}default:return}}function Wb(b,e){b=b|0;e=e|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0.0,G=0.0,H=0,I=0,J=0,K=0;g=a[e+11>>0]|0;h=g<<24>>24<0;i=h?c[e>>2]|0:e;j=h?c[e+4>>2]|0:g&255;if(j>>>0>3){g=i;h=j;k=j;while(1){l=w(d[g>>0]|d[g+1>>0]<<8|d[g+2>>0]<<16|d[g+3>>0]<<24,1540483477)|0;h=(w(l>>>24^l,1540483477)|0)^(w(h,1540483477)|0);k=k+-4|0;if(k>>>0<=3)break;else g=g+4|0}g=j+-4|0;k=g&-4;m=g-k|0;n=i+(k+4)|0;o=h}else{m=j;n=i;o=j}switch(m|0){case 3:{p=d[n+2>>0]<<16^o;q=7;break}case 2:{p=o;q=7;break}case 1:{r=o;q=8;break}default:s=o}if((q|0)==7){r=d[n+1>>0]<<8^p;q=8}if((q|0)==8)s=w(r^d[n>>0],1540483477)|0;n=w(s>>>13^s,1540483477)|0;s=n>>>15^n;n=b+4|0;r=c[n>>2]|0;p=(r|0)==0;a:do if(!p){o=r+-1|0;m=(o&r|0)==0;if(!m)if(s>>>0<r>>>0)t=s;else t=(s>>>0)%(r>>>0)|0;else t=s&o;h=c[(c[b>>2]|0)+(t<<2)>>2]|0;if((h|0)!=0?(k=c[h>>2]|0,(k|0)!=0):0){h=(j|0)==0;if(m){if(h){m=k;while(1){g=c[m+4>>2]|0;if(!((g|0)==(s|0)|(g&o|0)==(t|0))){u=t;break a}g=a[m+8+11>>0]|0;if(!((g<<24>>24<0?c[m+12>>2]|0:g&255)|0)){x=m;break}m=c[m>>2]|0;if(!m){u=t;break a}}y=x+20|0;return y|0}m=k;b:while(1){g=c[m+4>>2]|0;if(!((g|0)==(s|0)|(g&o|0)==(t|0))){u=t;break a}g=m+8|0;l=a[g+11>>0]|0;z=l<<24>>24<0;A=l&255;do if(((z?c[m+12>>2]|0:A)|0)==(j|0)){l=c[g>>2]|0;if(z)if(!(Xh(l,i,j)|0)){x=m;q=68;break b}else break;if((a[i>>0]|0)==(l&255)<<24>>24){l=g;B=A;C=i;do{B=B+-1|0;l=l+1|0;if(!B){x=m;q=68;break b}C=C+1|0}while((a[l>>0]|0)==(a[C>>0]|0))}}while(0);m=c[m>>2]|0;if(!m){u=t;break a}}if((q|0)==68){y=x+20|0;return y|0}}if(h){m=k;while(1){o=c[m+4>>2]|0;if((o|0)!=(s|0)){if(o>>>0<r>>>0)D=o;else D=(o>>>0)%(r>>>0)|0;if((D|0)!=(t|0)){u=t;break a}}o=a[m+8+11>>0]|0;if(!((o<<24>>24<0?c[m+12>>2]|0:o&255)|0)){x=m;break}m=c[m>>2]|0;if(!m){u=t;break a}}y=x+20|0;return y|0}m=k;c:while(1){h=c[m+4>>2]|0;if((h|0)!=(s|0)){if(h>>>0<r>>>0)E=h;else E=(h>>>0)%(r>>>0)|0;if((E|0)!=(t|0)){u=t;break a}}h=m+8|0;o=a[h+11>>0]|0;A=o<<24>>24<0;g=o&255;do if(((A?c[m+12>>2]|0:g)|0)==(j|0)){o=c[h>>2]|0;if(A)if(!(Xh(o,i,j)|0)){x=m;q=68;break c}else break;if((a[i>>0]|0)==(o&255)<<24>>24){o=h;z=g;C=i;do{z=z+-1|0;o=o+1|0;if(!z){x=m;q=68;break c}C=C+1|0}while((a[o>>0]|0)==(a[C>>0]|0))}}while(0);m=c[m>>2]|0;if(!m){u=t;break a}}if((q|0)==68){y=x+20|0;return y|0}}else u=t}else u=0;while(0);t=ni(24)|0;wi(t+8|0,e);c[t+20>>2]=0;c[t+4>>2]=s;c[t>>2]=0;e=b+12|0;F=+(((c[e>>2]|0)+1|0)>>>0);G=+f[b+16>>2];do if(p|G*+(r>>>0)<F){i=r<<1|(r>>>0<3|(r+-1&r|0)!=0)&1;j=~~+v(+(F/G))>>>0;Zb(b,i>>>0<j>>>0?j:i);i=c[n>>2]|0;j=i+-1|0;if(!(j&i)){H=i;I=j&s;break}if(s>>>0<i>>>0){H=i;I=s}else{H=i;I=(s>>>0)%(i>>>0)|0}}else{H=r;I=u}while(0);u=(c[b>>2]|0)+(I<<2)|0;I=c[u>>2]|0;if(!I){r=b+8|0;c[t>>2]=c[r>>2];c[r>>2]=t;c[u>>2]=r;r=c[t>>2]|0;if(r|0){u=c[r+4>>2]|0;r=H+-1|0;if(r&H)if(u>>>0<H>>>0)J=u;else J=(u>>>0)%(H>>>0)|0;else J=u&r;K=(c[b>>2]|0)+(J<<2)|0;q=66}}else{c[t>>2]=c[I>>2];K=I;q=66}if((q|0)==66)c[K>>2]=t;c[e>>2]=(c[e>>2]|0)+1;x=t;y=x+20|0;return y|0}function Xb(b,e){b=b|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0;f=a[e+11>>0]|0;g=f<<24>>24<0;h=g?c[e>>2]|0:e;i=g?c[e+4>>2]|0:f&255;if(i>>>0>3){f=h;e=i;g=i;while(1){j=w(d[f>>0]|d[f+1>>0]<<8|d[f+2>>0]<<16|d[f+3>>0]<<24,1540483477)|0;e=(w(j>>>24^j,1540483477)|0)^(w(e,1540483477)|0);g=g+-4|0;if(g>>>0<=3)break;else f=f+4|0}f=i+-4|0;g=f&-4;k=f-g|0;l=h+(g+4)|0;m=e}else{k=i;l=h;m=i}switch(k|0){case 3:{n=d[l+2>>0]<<16^m;o=7;break}case 2:{n=m;o=7;break}case 1:{p=m;o=8;break}default:q=m}if((o|0)==7){p=d[l+1>>0]<<8^n;o=8}if((o|0)==8)q=w(p^d[l>>0],1540483477)|0;l=w(q>>>13^q,1540483477)|0;q=l>>>15^l;l=c[b+4>>2]|0;if(!l){r=0;return r|0}p=l+-1|0;n=(p&l|0)==0;if(!n)if(q>>>0<l>>>0)s=q;else s=(q>>>0)%(l>>>0)|0;else s=q&p;m=c[(c[b>>2]|0)+(s<<2)>>2]|0;if(!m){r=0;return r|0}b=c[m>>2]|0;if(!b){r=0;return r|0}m=(i|0)==0;if(n){n=b;a:while(1){k=c[n+4>>2]|0;e=(k|0)==(q|0);if(!(e|(k&p|0)==(s|0))){r=0;o=45;break}do if(e?(k=n+8|0,g=a[k+11>>0]|0,f=g<<24>>24<0,j=g&255,((f?c[n+12>>2]|0:j)|0)==(i|0)):0){g=c[k>>2]|0;t=f?g:k;u=g&255;if(f){if(m){r=n;o=45;break a}if(!(Xh(t,h,i)|0)){r=n;o=45;break a}else break}if(m){r=n;o=45;break a}if((a[h>>0]|0)==u<<24>>24){u=k;k=j;j=h;do{k=k+-1|0;u=u+1|0;if(!k){r=n;o=45;break a}j=j+1|0}while((a[u>>0]|0)==(a[j>>0]|0))}}while(0);n=c[n>>2]|0;if(!n){r=0;o=45;break}}if((o|0)==45)return r|0}n=b;b:while(1){b=c[n+4>>2]|0;do if((b|0)==(q|0)){p=n+8|0;e=a[p+11>>0]|0;j=e<<24>>24<0;u=e&255;if(((j?c[n+12>>2]|0:u)|0)==(i|0)){e=c[p>>2]|0;k=j?e:p;t=e&255;if(j){if(m){r=n;o=45;break b}if(!(Xh(k,h,i)|0)){r=n;o=45;break b}else break}if(m){r=n;o=45;break b}if((a[h>>0]|0)==t<<24>>24){t=p;p=u;u=h;do{p=p+-1|0;t=t+1|0;if(!p){r=n;o=45;break b}u=u+1|0}while((a[t>>0]|0)==(a[u>>0]|0))}}}else{if(b>>>0<l>>>0)v=b;else v=(b>>>0)%(l>>>0)|0;if((v|0)!=(s|0)){r=0;o=45;break b}}while(0);n=c[n>>2]|0;if(!n){r=0;o=45;break}}if((o|0)==45)return r|0;return 0}function Yb(b,d){b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0;e=b+4|0;f=c[b>>2]|0;g=((c[e>>2]|0)-f|0)/12|0;h=g+1|0;if(h>>>0>357913941)Si(b);i=b+8|0;j=((c[i>>2]|0)-f|0)/12|0;f=j<<1;k=j>>>0<178956970?(f>>>0<h>>>0?h:f):357913941;do if(k)if(k>>>0>357913941){f=da(8)|0;ti(f,10959);c[f>>2]=6220;ha(f|0,3864,124)}else{l=ni(k*12|0)|0;break}else l=0;while(0);f=l+(g*12|0)|0;g=l+(k*12|0)|0;wi(f,d);d=f+12|0;k=c[b>>2]|0;l=c[e>>2]|0;if((l|0)==(k|0)){m=f;n=k;o=k}else{h=l;l=f;do{l=l+-12|0;h=h+-12|0;c[l>>2]=c[h>>2];c[l+4>>2]=c[h+4>>2];c[l+8>>2]=c[h+8>>2];c[h>>2]=0;c[h+4>>2]=0;c[h+8>>2]=0}while((h|0)!=(k|0));m=l;n=c[b>>2]|0;o=c[e>>2]|0}c[b>>2]=m;c[e>>2]=d;c[i>>2]=g;g=n;if((o|0)!=(g|0)){i=o;do{i=i+-12|0;if((a[i+11>>0]|0)<0)oi(c[i>>2]|0)}while((i|0)!=(g|0))}if(!n)return;oi(n);return}function Zb(a,b){a=a|0;b=b|0;var d=0,e=0,g=0,h=0;if((b|0)!=1)if(!(b+-1&b))d=b;else d=ji(b)|0;else d=2;b=c[a+4>>2]|0;if(d>>>0>b>>>0){_b(a,d);return}if(d>>>0>=b>>>0)return;e=~~+v(+(+((c[a+12>>2]|0)>>>0)/+f[a+16>>2]))>>>0;if(b>>>0>2&(b+-1&b|0)==0){g=1<<32-(x(e+-1|0)|0);h=e>>>0<2?e:g}else h=ji(e)|0;e=d>>>0<h>>>0?h:d;if(e>>>0>=b>>>0)return;_b(a,e);return}function _b(b,d){b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0;e=b+4|0;if(!d){f=c[b>>2]|0;c[b>>2]=0;if(f|0)oi(f);c[e>>2]=0;return}if(d>>>0>1073741823){f=da(8)|0;ti(f,10959);c[f>>2]=6220;ha(f|0,3864,124)}f=ni(d<<2)|0;g=c[b>>2]|0;c[b>>2]=f;if(g|0)oi(g);c[e>>2]=d;e=0;do{c[(c[b>>2]|0)+(e<<2)>>2]=0;e=e+1|0}while((e|0)!=(d|0));e=b+8|0;g=c[e>>2]|0;if(!g)return;f=c[g+4>>2]|0;h=d+-1|0;i=(h&d|0)==0;if(!i)if(f>>>0<d>>>0)j=f;else j=(f>>>0)%(d>>>0)|0;else j=f&h;c[(c[b>>2]|0)+(j<<2)>>2]=e;e=c[g>>2]|0;if(!e)return;f=j;j=e;e=g;while(1){g=c[j+4>>2]|0;if(!i)if(g>>>0<d>>>0)k=g;else k=(g>>>0)%(d>>>0)|0;else k=g&h;do if((k|0)==(f|0)){l=f;m=j}else{g=(c[b>>2]|0)+(k<<2)|0;if(!(c[g>>2]|0)){c[g>>2]=e;l=k;m=j;break}g=c[j>>2]|0;a:do if(!g)n=j;else{o=j+8|0;p=a[o+11>>0]|0;q=p<<24>>24<0;r=p&255;p=q?c[j+12>>2]|0:r;s=(p|0)==0;if(q){q=j;t=g;while(1){u=t+8|0;v=a[u+11>>0]|0;w=v<<24>>24<0;if((p|0)!=((w?c[t+12>>2]|0:v&255)|0)){n=q;break a}if(!s?Xh(c[o>>2]|0,w?c[u>>2]|0:u,p)|0:0){n=q;break a}u=c[t>>2]|0;if(!u){n=t;break a}else{w=t;t=u;q=w}}}if(s){q=j;t=g;while(1){w=a[t+8+11>>0]|0;if((w<<24>>24<0?c[t+12>>2]|0:w&255)|0){n=q;break a}w=c[t>>2]|0;if(!w){n=t;break a}else{u=t;t=w;q=u}}}q=j;t=g;while(1){s=t+8|0;u=a[s+11>>0]|0;w=u<<24>>24<0;if((p|0)!=((w?c[t+12>>2]|0:u&255)|0)){n=q;break a}u=w?c[s>>2]|0:s;if((a[u>>0]|0)!=(c[o>>2]&255)<<24>>24){n=q;break a}s=o;w=r;v=u;while(1){w=w+-1|0;s=s+1|0;if(!w)break;v=v+1|0;if((a[s>>0]|0)!=(a[v>>0]|0)){n=q;break a}}v=c[t>>2]|0;if(!v){n=t;break}else{s=t;t=v;q=s}}}while(0);c[e>>2]=c[n>>2];c[n>>2]=c[c[(c[b>>2]|0)+(k<<2)>>2]>>2];c[c[(c[b>>2]|0)+(k<<2)>>2]>>2]=j;l=f;m=e}while(0);j=c[m>>2]|0;if(!j)break;else{f=l;e=m}}return}function $b(a){a=a|0;li(a);oi(a);return}function ac(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;od(b);oi(b);return}function bc(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==11691?a+12|0:0)|0}function cc(a){a=a|0;oi(a);return}function dc(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0;d=Ia;Ia=Ia+16|0;if((Ia|0)>=(Ja|0))B(16);e=d;if((b|0)==(a|0)){Ia=d;return}f=a+16|0;g=c[f>>2]|0;h=g;i=b+16|0;if((g|0)==(a|0))if((c[i>>2]|0)==(b|0)){Ra[c[(c[g>>2]|0)+12>>2]&31](g,e);j=c[f>>2]|0;Pa[c[(c[j>>2]|0)+16>>2]&255](j);c[f>>2]=0;j=c[i>>2]|0;Ra[c[(c[j>>2]|0)+12>>2]&31](j,a);j=c[i>>2]|0;Pa[c[(c[j>>2]|0)+16>>2]&255](j);c[i>>2]=0;c[f>>2]=a;Ra[c[(c[e>>2]|0)+12>>2]&31](e,b);Pa[c[(c[e>>2]|0)+16>>2]&255](e);c[i>>2]=b;Ia=d;return}else{Ra[c[(c[g>>2]|0)+12>>2]&31](g,b);g=c[f>>2]|0;Pa[c[(c[g>>2]|0)+16>>2]&255](g);g=b+16|0;c[f>>2]=c[g>>2];c[g>>2]=b;Ia=d;return}else{g=c[i>>2]|0;if((b|0)==(g|0)){Ra[c[(c[g>>2]|0)+12>>2]&31](g,a);b=c[i>>2]|0;Pa[c[(c[b>>2]|0)+16>>2]&255](b);c[i>>2]=c[f>>2];c[f>>2]=a;Ia=d;return}else{c[f>>2]=g;c[i>>2]=h;Ia=d;return}}}function ec(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0;d=Ia;Ia=Ia+16|0;if((Ia|0)>=(Ja|0))B(16);e=d;if((b|0)==(a|0)){Ia=d;return}f=a+16|0;g=c[f>>2]|0;h=g;i=b+16|0;if((g|0)==(a|0))if((c[i>>2]|0)==(b|0)){Ra[c[(c[g>>2]|0)+12>>2]&31](g,e);j=c[f>>2]|0;Pa[c[(c[j>>2]|0)+16>>2]&255](j);c[f>>2]=0;j=c[i>>2]|0;Ra[c[(c[j>>2]|0)+12>>2]&31](j,a);j=c[i>>2]|0;Pa[c[(c[j>>2]|0)+16>>2]&255](j);c[i>>2]=0;c[f>>2]=a;Ra[c[(c[e>>2]|0)+12>>2]&31](e,b);Pa[c[(c[e>>2]|0)+16>>2]&255](e);c[i>>2]=b;Ia=d;return}else{Ra[c[(c[g>>2]|0)+12>>2]&31](g,b);g=c[f>>2]|0;Pa[c[(c[g>>2]|0)+16>>2]&255](g);g=b+16|0;c[f>>2]=c[g>>2];c[g>>2]=b;Ia=d;return}else{g=c[i>>2]|0;if((b|0)==(g|0)){Ra[c[(c[g>>2]|0)+12>>2]&31](g,a);b=c[i>>2]|0;Pa[c[(c[b>>2]|0)+16>>2]&255](b);c[i>>2]=c[f>>2];c[f>>2]=a;Ia=d;return}else{c[f>>2]=g;c[i>>2]=h;Ia=d;return}}}function fc(a){a=a|0;var b=0,d=0;c[a>>2]=4184;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Pa[c[(c[b>>2]|0)+8>>2]&255](b);mi(b);return}function gc(a){a=a|0;var b=0,d=0,e=0;c[a>>2]=4184;b=c[a+12>>2]|0;if(!b){oi(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){oi(a);return}Pa[c[(c[b>>2]|0)+8>>2]&255](b);mi(b);oi(a);return}function hc(a){a=a|0;var b=0,d=0,e=0;b=ni(20)|0;c[b>>2]=4184;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(d|0){e=d+4|0;c[e>>2]=(c[e>>2]|0)+1}c[b+16>>2]=c[a+16>>2];return b|0}function ic(a,b){a=a|0;b=b|0;var d=0,e=0;c[b>>2]=4184;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(d|0){e=d+4|0;c[e>>2]=(c[e>>2]|0)+1}c[b+16>>2]=c[a+16>>2];return}function jc(a){a=a|0;var b=0,d=0;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Pa[c[(c[b>>2]|0)+8>>2]&255](b);mi(b);return}function kc(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b){oi(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){oi(a);return}Pa[c[(c[b>>2]|0)+8>>2]&255](b);mi(b);oi(a);return}function lc(a,b){a=a|0;b=b|0;pc(a+4|0,b);return}function mc(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==11862?a+4|0:0)|0}function nc(a){a=a|0;return 2968}function oc(a){a=a|0;return}function pc(b,d){b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0;d=c[b+12>>2]|0;e=d+76|0;f=c[b>>2]|0;if((c[e>>2]|0)==(f|0))return;c[e>>2]=f;f=c[b+4>>2]|0;e=d+4|0;g=c[e>>2]|0;h=(c[g+((c[f+4>>2]|0)*48|0)+32>>2]|0)+1|0;if((c[g+(h*48|0)+44>>2]|0)==6)c[g+(h*48|0)+36>>2]=255;h=d+40|0;i=(c[g+((c[(c[h>>2]|0)+4>>2]|0)*48|0)+32>>2]|0)+1|0;if((c[g+(i*48|0)+44>>2]|0)==6)c[g+(i*48|0)+36>>2]=-2139062017;i=c[b+8>>2]|0;if(i|0){g=i+4|0;c[g>>2]=(c[g>>2]|0)+1}c[h>>2]=f;f=d+44|0;h=c[f>>2]|0;c[f>>2]=i;if(h|0?(i=h+4|0,f=c[i>>2]|0,c[i>>2]=f+-1,(f|0)==0):0){Pa[c[(c[h>>2]|0)+8>>2]&255](h);mi(h)}h=c[d+48>>2]|0;a[h+65>>0]=0;a[h+145>>0]=0;a[h+225>>0]=0;c[(c[e>>2]|0)+((c[h+4>>2]|0)*48|0)+40>>2]=0;nb(d,(c[d+64>>2]|0)+((c[b>>2]|0)*80|0)|0);return}function qc(a){a=a|0;oi(a);return}function rc(a){a=a|0;a=ni(8)|0;c[a>>2]=4228;return a|0}function sc(a,b){a=a|0;b=b|0;c[b>>2]=4228;return}function tc(a){a=a|0;return}function uc(a){a=a|0;oi(a);return}function vc(a){a=a|0;return}function wc(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==12003?a+4|0:0)|0}function xc(a){a=a|0;return 3e3}function yc(a){a=a|0;return}function zc(a){a=a|0;oi(a);return}function Ac(a){a=a|0;a=ni(8)|0;c[a>>2]=4272;return a|0}function Bc(a,b){a=a|0;b=b|0;c[b>>2]=4272;return}function Cc(a){a=a|0;return}function Dc(a){a=a|0;oi(a);return}function Ec(a){a=a|0;return}function Fc(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==12102?a+4|0:0)|0}function Gc(a){a=a|0;return 3024}function Hc(a){a=a|0;oi(a);return}function Ic(a){a=a|0;var b=0;b=ni(8)|0;c[b>>2]=4316;c[b+4>>2]=c[a+4>>2];return b|0}function Jc(a,b){a=a|0;b=b|0;c[b>>2]=4316;c[b+4>>2]=c[a+4>>2];return}function Kc(a){a=a|0;return}function Lc(a){a=a|0;oi(a);return}function Mc(a,b){a=a|0;b=b|0;Pc(c[a+4>>2]|0);return}function Nc(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==12448?a+4|0:0)|0}function Oc(a){a=a|0;return 3088}function Pc(b){b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0;d=Ia;Ia=Ia+16|0;if((Ia|0)>=(Ja|0))B(16);e=d+8|0;f=d;g=c[b+76>>2]|0;h=c[b+64>>2]|0;i=b+56|0;j=c[i>>2]|0;k=c[j+332>>2]|0;c[e>>2]=0;c[e+4>>2]=k+-1;l=c[j+336>>2]|0;c[f>>2]=0;c[f+4>>2]=l+-1;if((l|0)<=0){m=b+48|0;n=c[m>>2]|0;o=n+65|0;a[o>>0]=0;p=n+145|0;a[p>>0]=0;q=n+225|0;a[q>>0]=0;r=n+4|0;s=c[r>>2]|0;t=b+4|0;u=c[t>>2]|0;v=u+(s*48|0)+40|0;c[v>>2]=0;Ia=d;return}l=h+(g*80|0)+12|0;w=h+(g*80|0)+8|0;g=b+4|0;h=0;x=k;k=j;while(1){if((x|0)>0){j=0;y=k;while(1){if(((h|0)%(c[l>>2]|0)|0|0)==0?((j|0)%(c[w>>2]|0)|0|0)==0:0)z=y;else{A=0;C=0;while(1){if((C>>>0)%((c[w>>2]|0)>>>0)|0|0){D=C;E=A;break}F=Rc(f,18348,f)|0;G=Rc(e,18348,e)|0;if(!((F>>>0)%((c[l>>2]|0)>>>0)|0)){A=F;C=G}else{D=G;E=F;break}}Qc(c[i>>2]|0,g,h,j,E,D);z=c[i>>2]|0}j=j+1|0;C=c[z+332>>2]|0;if((j|0)>=(C|0)){H=C;I=z;break}else y=z}}else{H=x;I=k}h=h+1|0;if((h|0)>=(c[I+336>>2]|0))break;else{x=H;k=I}}m=b+48|0;n=c[m>>2]|0;o=n+65|0;a[o>>0]=0;p=n+145|0;a[p>>0]=0;q=n+225|0;a[q>>0]=0;r=n+4|0;s=c[r>>2]|0;t=b+4|0;u=c[t>>2]|0;v=u+(s*48|0)+40|0;c[v>>2]=0;Ia=d;return}function Qc(b,d,e,g,h,i){b=b|0;d=d|0;e=e|0;g=g|0;h=h|0;i=i|0;var j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0.0,C=0.0;d=Ia;Ia=Ia+80|0;if((Ia|0)>=(Ja|0))B(80);j=d+16|0;k=d+8|0;l=d;m=d+56|0;n=d+64|0;o=d+40|0;p=d+48|0;q=b+336|0;r=c[q>>2]|0;if(r>>>0>e>>>0?(c[b+332>>2]|0)>>>0>g>>>0:0)s=r;else{c[l>>2]=e;c[l+4>>2]=g;bi(12255,l)|0;s=c[q>>2]|0}if(!(s>>>0>h>>>0?(c[b+332>>2]|0)>>>0>i>>>0:0)){c[k>>2]=h;c[k+4>>2]=i;bi(12255,k)|0}k=b+424|0;s=c[k>>2]|0;q=c[s+(e*12|0)>>2]|0;l=c[q+(g<<3)>>2]|0;r=c[q+(g<<3)+4>>2]|0;q=(r|0)==0;if(q)t=s;else{s=r+4|0;c[s>>2]=(c[s>>2]|0)+1;t=c[k>>2]|0}s=c[t+(h*12|0)>>2]|0;u=c[s+(i<<3)>>2]|0;v=c[s+(i<<3)+4>>2]|0;s=(v|0)==0;if(s)w=t;else{t=v+4|0;c[t>>2]=(c[t>>2]|0)+1;w=c[k>>2]|0}t=l;c[t+324>>2]=h;c[t+328>>2]=i;x=u;c[x+324>>2]=e;c[x+328>>2]=g;y=c[w+(e*12|0)>>2]|0;if(!s){w=v+4|0;c[w>>2]=(c[w>>2]|0)+1}c[y+(g<<3)>>2]=u;w=y+(g<<3)+4|0;y=c[w>>2]|0;c[w>>2]=v;if(y|0?(w=y+4|0,z=c[w>>2]|0,c[w>>2]=z+-1,(z|0)==0):0){Pa[c[(c[y>>2]|0)+8>>2]&255](y);mi(y)}y=c[(c[k>>2]|0)+(h*12|0)>>2]|0;if(!q){k=r+4|0;c[k>>2]=(c[k>>2]|0)+1}c[y+(i<<3)>>2]=l;k=y+(i<<3)+4|0;y=c[k>>2]|0;c[k>>2]=r;if(y|0?(k=y+4|0,z=c[k>>2]|0,c[k>>2]=z+-1,(z|0)==0):0){Pa[c[(c[y>>2]|0)+8>>2]&255](y);mi(y)}c[j>>2]=t;c[j+4>>2]=e;c[j+8>>2]=g;c[j+12>>2]=x;c[j+16>>2]=h;c[j+20>>2]=i;bi(12213,j)|0;y=ni(72)|0;if(!q){z=r+4|0;c[z>>2]=(c[z>>2]|0)+1}z=b+440|0;k=b+448|0;A=+f[z>>2]*+(i|0)+ +f[k>>2]*+(i+1|0);i=b+444|0;w=b+452|0;C=+f[i>>2]*+(h|0)+ +f[w>>2]*+(h+1|0);a[y+4>>0]=0;a[y+5>>0]=0;c[y+24>>2]=0;c[y>>2]=4360;c[y+32>>2]=l;c[y+36>>2]=r;if(!q){l=r+4|0;c[l>>2]=(c[l>>2]|0)+1}c[y+40>>2]=0;f[y+44>>2]=0.0;f[y+48>>2]=0.0;f[y+52>>2]=A;f[y+56>>2]=C;f[y+60>>2]=1.0e3;f[y+64>>2]=100.0;f[y+68>>2]=1.0000000474974513e-03;c[n>>2]=0;c[j>>2]=c[n>>2];Sc(m,y,j);if(!q?(y=r+4|0,n=c[y>>2]|0,c[y>>2]=n+-1,(n|0)==0):0){Pa[c[(c[r>>2]|0)+8>>2]&255](r);mi(r)}n=c[m>>2]|0;y=m+4|0;m=c[y>>2]|0;if(m|0){l=m+4|0;c[l>>2]=(c[l>>2]|0)+1}c[t+304>>2]=n;n=t+308|0;t=c[n>>2]|0;c[n>>2]=m;if(t|0?(m=t+4|0,n=c[m>>2]|0,c[m>>2]=n+-1,(n|0)==0):0){Pa[c[(c[t>>2]|0)+8>>2]&255](t);mi(t)}t=ni(72)|0;if(!s){n=v+4|0;c[n>>2]=(c[n>>2]|0)+1}C=+f[z>>2]*+(g|0)+ +f[k>>2]*+(g+1|0);A=+f[i>>2]*+(e|0)+ +f[w>>2]*+(e+1|0);a[t+4>>0]=0;a[t+5>>0]=0;c[t+24>>2]=0;c[t>>2]=4360;c[t+32>>2]=u;c[t+36>>2]=v;if(!s){u=v+4|0;c[u>>2]=(c[u>>2]|0)+1}c[t+40>>2]=0;f[t+44>>2]=0.0;f[t+48>>2]=0.0;f[t+52>>2]=C;f[t+56>>2]=A;f[t+60>>2]=1.0e3;f[t+64>>2]=100.0;f[t+68>>2]=1.0000000474974513e-03;c[p>>2]=0;c[j>>2]=c[p>>2];Sc(o,t,j);if(!s?(j=v+4|0,t=c[j>>2]|0,c[j>>2]=t+-1,(t|0)==0):0){Pa[c[(c[v>>2]|0)+8>>2]&255](v);mi(v)}t=c[o>>2]|0;j=o+4|0;o=c[j>>2]|0;if(o|0){p=o+4|0;c[p>>2]=(c[p>>2]|0)+1}c[x+304>>2]=t;t=x+308|0;x=c[t>>2]|0;c[t>>2]=o;if(x|0?(o=x+4|0,t=c[o>>2]|0,c[o>>2]=t+-1,(t|0)==0):0){Pa[c[(c[x>>2]|0)+8>>2]&255](x);mi(x)}x=c[j>>2]|0;do if(x|0){j=x+4|0;t=c[j>>2]|0;c[j>>2]=t+-1;if(t|0)break;Pa[c[(c[x>>2]|0)+8>>2]&255](x);mi(x)}while(0);x=c[y>>2]|0;do if(x|0){y=x+4|0;t=c[y>>2]|0;c[y>>2]=t+-1;if(t|0)break;Pa[c[(c[x>>2]|0)+8>>2]&255](x);mi(x)}while(0);do if(!s){x=v+4|0;t=c[x>>2]|0;c[x>>2]=t+-1;if(t|0)break;Pa[c[(c[v>>2]|0)+8>>2]&255](v);mi(v)}while(0);if(q){Ia=d;return}q=r+4|0;v=c[q>>2]|0;c[q>>2]=v+-1;if(v|0){Ia=d;return}Pa[c[(c[r>>2]|0)+8>>2]&255](r);mi(r);Ia=d;return}function Rc(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;a=c[d>>2]|0;e=(c[d+4>>2]|0)-a|0;f=e+1|0;if(!e){g=a;return g|0}if(!f){a=b+2496|0;e=c[a>>2]|0;h=((e+1|0)>>>0)%624|0;i=b+(e<<2)|0;j=c[b+(h<<2)>>2]|0;k=0-(j&1)&-1727483681^c[b+((((e+397|0)>>>0)%624|0)<<2)>>2]^(j&2147483646|c[i>>2]&-2147483648)>>>1;c[i>>2]=k;i=k>>>11^k;c[a>>2]=h;h=i<<7&-1658038656^i;i=h<<15&-272236544^h;g=i>>>18^i;return g|0}i=32-(x(f|0)|0)|0;h=i+(((-1>>>(33-i|0)&f|0)==0)<<31>>31)|0;i=(h>>>5)+((h&31|0)!=0&1)|0;a=i>>>0>h>>>0?0:-1>>>(32-((h>>>0)/(i>>>0)|0)|0);i=b+2496|0;h=c[i>>2]|0;do{k=h;h=((h+1|0)>>>0)%624|0;j=b+(k<<2)|0;e=c[b+(h<<2)>>2]|0;l=0-(e&1)&-1727483681^c[b+((((k+397|0)>>>0)%624|0)<<2)>>2]^(e&2147483646|c[j>>2]&-2147483648)>>>1;c[j>>2]=l;j=l>>>11^l;l=j<<7&-1658038656^j;j=l<<15&-272236544^l;m=(j>>>18^j)&a}while(m>>>0>=f>>>0);c[i>>2]=h;g=(c[d>>2]|0)+m|0;return g|0}function Sc(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;d=Ia;Ia=Ia+16|0;if((Ia|0)>=(Ja|0))B(16);e=d;c[a>>2]=b;f=ni(16)|0;c[f+4>>2]=0;c[f+8>>2]=0;c[f>>2]=4384;c[f+12>>2]=b;c[a+4>>2]=f;c[e>>2]=b;c[e+4>>2]=b;Vc(a,e);Ia=d;return}function Tc(b,d,e){b=b|0;d=d|0;e=+e;var g=0,h=0,i=0,j=0.0,k=0.0,l=0.0,m=0.0,n=0.0,o=0.0,p=0.0,q=0.0,r=0.0,t=0.0,u=0.0,v=0.0,w=0.0,x=0.0,y=0.0,z=0.0,A=0.0,B=0.0,C=0.0;switch(c[b+40>>2]|0){case 0:{g=(c[b+32>>2]|0)+4|0;h=c[g>>2]|0;i=c[d>>2]|0;j=e/1.0e3;k=+f[i+(h*48|0)>>2];l=+f[b+52>>2];m=+f[i+(h*48|0)+4>>2];n=+f[b+56>>2];o=-+f[b+60>>2];h=b+44|0;p=-+f[b+64>>2];q=+f[h>>2];i=b+48|0;r=+f[i>>2];t=q+j*((k-l)*o+q*p);u=r+j*((m-n)*o+r*p);p=k+j*q;q=m+j*r;r=+s(+(p-l));m=+f[b+68>>2];if((r<m?+s(+t)<m&+s(+(q-n))<m:0)?j>0.0&+s(+u)<m:0){c[h>>2]=0;c[i>>2]=0;a[b+4>>0]=1;v=l;w=n}else{f[h>>2]=t;f[i>>2]=u;v=p;w=q}i=c[g>>2]|0;g=c[d>>2]|0;f[g+(i*48|0)>>2]=v;f[g+(i*48|0)+4>>2]=w;return}case 1:{i=(c[b+32>>2]|0)+4|0;g=c[i>>2]|0;h=c[d>>2]|0;w=e/1.0e3;v=+f[h+(g*48|0)+16>>2];q=+f[b+52>>2];p=+f[h+(g*48|0)+20>>2];u=+f[b+56>>2];t=-+f[b+60>>2];g=b+44|0;n=-+f[b+64>>2];l=+f[g>>2];h=b+48|0;m=+f[h>>2];j=l+w*((v-q)*t+l*n);r=m+w*((p-u)*t+m*n);n=v+w*l;l=p+w*m;m=+s(+(n-q));p=+f[b+68>>2];if((m<p?+s(+j)<p&+s(+(l-u))<p:0)?w>0.0&+s(+r)<p:0){c[g>>2]=0;c[h>>2]=0;a[b+4>>0]=1;x=q;y=u}else{f[g>>2]=j;f[h>>2]=r;x=n;y=l}h=c[i>>2]|0;i=c[d>>2]|0;f[i+(h*48|0)+16>>2]=x;f[i+(h*48|0)+20>>2]=y;return}case 2:{h=(c[b+32>>2]|0)+4|0;i=c[h>>2]|0;g=c[d>>2]|0;y=e/1.0e3;x=+f[g+(i*48|0)+8>>2];l=+f[b+52>>2];n=+f[g+(i*48|0)+12>>2];r=+f[b+56>>2];j=-+f[b+60>>2];i=b+44|0;u=-+f[b+64>>2];q=+f[i>>2];g=b+48|0;p=+f[g>>2];w=q+y*((x-l)*j+q*u);m=p+y*((n-r)*j+p*u);u=x+y*q;q=n+y*p;p=+s(+(u-l));n=+f[b+68>>2];if((p<n?+s(+w)<n&+s(+(q-r))<n:0)?y>0.0&+s(+m)<n:0){c[i>>2]=0;c[g>>2]=0;a[b+4>>0]=1;z=l;A=r}else{f[i>>2]=w;f[g>>2]=m;z=u;A=q}g=c[h>>2]|0;h=c[d>>2]|0;f[h+(g*48|0)+8>>2]=z;f[h+(g*48|0)+12>>2]=A;return}case 3:{g=(c[b+32>>2]|0)+4|0;h=c[g>>2]|0;i=c[d>>2]|0;A=e/1.0e3;e=+f[i+(h*48|0)+24>>2];z=+f[b+52>>2];q=+f[i+(h*48|0)+28>>2];u=+f[b+56>>2];m=-+f[b+60>>2];h=b+44|0;w=-+f[b+64>>2];r=+f[h>>2];i=b+48|0;l=+f[i>>2];n=r+A*((e-z)*m+r*w);y=l+A*((q-u)*m+l*w);w=e+A*r;r=q+A*l;l=+s(+(w-z));q=+f[b+68>>2];if((l<q?+s(+n)<q&+s(+(r-u))<q:0)?A>0.0&+s(+y)<q:0){c[h>>2]=0;c[i>>2]=0;a[b+4>>0]=1;B=z;C=u}else{f[h>>2]=n;f[i>>2]=y;B=w;C=r}i=c[g>>2]|0;g=c[d>>2]|0;f[g+(i*48|0)+24>>2]=B;f[g+(i*48|0)+28>>2]=C;return}default:return}}function Uc(a,b,c){a=a|0;b=b|0;c=+c;return}function Vc(a,b){a=a|0;b=b|0;return}function Wc(a){a=a|0;li(a);oi(a);return}function Xc(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b)return;c[b>>2]=4360;a=c[b+36>>2]|0;if(a|0?(d=a+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){Pa[c[(c[a>>2]|0)+8>>2]&255](a);mi(a)}c[b>>2]=4372;a=c[b+24>>2]|0;if((b+8|0)!=(a|0)){if(a|0)Pa[c[(c[a>>2]|0)+20>>2]&255](a)}else Pa[c[(c[a>>2]|0)+16>>2]&255](a);oi(b);return}function Yc(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==12404?a+12|0:0)|0}function Zc(a){a=a|0;oi(a);return}function _c(a){a=a|0;oi(a);return}function $c(a){a=a|0;var b=0;b=ni(8)|0;c[b>>2]=4412;c[b+4>>2]=c[a+4>>2];return b|0}function ad(a,b){a=a|0;b=b|0;c[b>>2]=4412;c[b+4>>2]=c[a+4>>2];return}function bd(a){a=a|0;return}function cd(a){a=a|0;oi(a);return}function dd(a){a=a|0;return gd(a+4|0)|0}function ed(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==12786?a+4|0:0)|0}function fd(a){a=a|0;return 3152}function gd(a){a=a|0;var b=0,d=0,e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0;b=Ia;Ia=Ia+80|0;if((Ia|0)>=(Ja|0))B(80);d=b;e=b+24|0;g=b+8|0;h=b+16|0;i=c[a>>2]|0;a=ni(328)|0;j=i+4|0;jb(a,j);c[a>>2]=4028;k=e+8|0;l=k+36|0;do{c[k>>2]=0;k=k+4|0}while((k|0)<(l|0));c[e+44>>2]=5;c[e>>2]=0;c[e+4>>2]=0;c[e+16>>2]=0;c[e+20>>2]=0;c[e+36>>2]=-16711681;m=i+8|0;n=c[m>>2]|0;o=c[j>>2]|0;c[o+((c[a+4>>2]|0)*48|0)+36>>2]=(n-o|0)/48|0;o=i+12|0;if((c[o>>2]|0)==(n|0))Gb(j,e);else{k=n;p=e;l=k+48|0;do{c[k>>2]=c[p>>2];k=k+4|0;p=p+4|0}while((k|0)<(l|0));c[m>>2]=(c[m>>2]|0)+48}n=ni(328)|0;jb(n,j);c[n>>2]=4456;k=e+8|0;l=k+36|0;do{c[k>>2]=0;k=k+4|0}while((k|0)<(l|0));c[e+44>>2]=2;c[e>>2]=0;c[e+4>>2]=0;f[e+16>>2]=0.0;f[e+20>>2]=0.0;c[e+32>>2]=255;i=c[m>>2]|0;q=c[j>>2]|0;c[q+((c[n+4>>2]|0)*48|0)+36>>2]=(i-q|0)/48|0;if((c[o>>2]|0)==(i|0))Gb(j,e);else{k=i;p=e;l=k+48|0;do{c[k>>2]=c[p>>2];k=k+4|0;p=p+4|0}while((k|0)<(l|0));c[m>>2]=(c[m>>2]|0)+48}c[g>>2]=n;m=ni(16)|0;c[m+4>>2]=0;c[m+8>>2]=0;c[m>>2]=4480;c[m+12>>2]=n;p=g+4|0;c[p>>2]=m;c[d>>2]=n;c[d+4>>2]=n;jd(g,d);d=(c[g>>2]|0)+4|0;n=c[d>>2]|0;m=c[j>>2]|0;c[m+(n*48|0)+8>>2]=1036831949;c[m+(n*48|0)+12>>2]=1036831949;n=c[d>>2]|0;d=c[j>>2]|0;c[d+(n*48|0)>>2]=1056964608;c[d+(n*48|0)+4>>2]=1056964608;n=c[g>>2]|0;c[n+8>>2]=1056964608;c[n+12>>2]=1056964608;g=c[(c[a>>2]|0)+4>>2]|0;c[h>>2]=n;n=h+4|0;d=c[p>>2]|0;c[n>>2]=d;if(d|0){m=d+4|0;c[m>>2]=(c[m>>2]|0)+1}Ta[g&3](a,j,h);h=c[n>>2]|0;if(h|0?(n=h+4|0,j=c[n>>2]|0,c[n>>2]=j+-1,(j|0)==0):0){Pa[c[(c[h>>2]|0)+8>>2]&255](h);mi(h)}h=c[p>>2]|0;if(!h){Ia=b;return a|0}p=h+4|0;j=c[p>>2]|0;c[p>>2]=j+-1;if(j|0){Ia=b;return a|0}Pa[c[(c[h>>2]|0)+8>>2]&255](h);mi(h);Ia=b;return a|0}function hd(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0.0,o=0.0,p=0,q=0,r=0.0,s=0.0,t=0.0,u=0.0;g=Ia;Ia=Ia+32|0;if((Ia|0)>=(Ja|0))B(32);h=g+8|0;i=g;j=g+16|0;k=a+24|0;l=c[k+4>>2]|0;m=h;c[m>>2]=c[k>>2];c[m+4>>2]=l;l=a+16|0;m=c[l+4>>2]|0;k=i;c[k>>2]=c[l>>2];c[k+4>>2]=m;m=d;k=c[m+4>>2]|0;l=a+44|0;c[l>>2]=c[m>>2];c[l+4>>2]=k;k=e;l=c[k+4>>2]|0;m=a+36|0;c[m>>2]=c[k>>2];c[m+4>>2]=l;l=c[a+4>>2]|0;m=c[b>>2]|0;n=+f[m+(l*48|0)+8>>2]*+f[e>>2]+ +f[m+(l*48|0)+24>>2];k=e+4|0;o=+f[m+(l*48|0)+12>>2]*+f[k>>2]+ +f[m+(l*48|0)+28>>2];p=a+24|0;f[p>>2]=n;q=a+28|0;f[q>>2]=o;do if((c[a+56>>2]|0)==1){r=+f[a+52>>2];s=o*r;if(s<n){f[p>>2]=s;t=o;u=s;break}else{s=n/r;f[q>>2]=s;t=s;u=n;break}}else{t=o;u=n}while(0);n=+f[m+(l*48|0)+20>>2]+(+f[d+4>>2]+ +f[k>>2]*+f[m+(l*48|0)+4>>2]-t*+f[a+12>>2]);f[a+16>>2]=+f[m+(l*48|0)+16>>2]+(+f[d>>2]+ +f[e>>2]*+f[m+(l*48|0)>>2]-u*+f[a+8>>2]);f[a+20>>2]=n;Ua[c[(c[a>>2]|0)+12>>2]&15](a,b,i,h);yb(j,a,b);Ia=g;return}function id(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var g=0,h=0,i=0.0;e=c[b>>2]|0;b=(c[e+((c[a+4>>2]|0)*48|0)+32>>2]|0)+1|0;d=a+16|0;g=c[d+4>>2]|0;h=e+(b*48|0)|0;c[h>>2]=c[d>>2];c[h+4>>2]=g;i=+f[a+28>>2]*.5;f[e+(b*48|0)+16>>2]=+f[a+24>>2]*.5;f[e+(b*48|0)+20>>2]=i;return}function jd(a,b){a=a|0;b=b|0;return}function kd(a){a=a|0;li(a);oi(a);return}function ld(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;od(b);oi(b);return}function md(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==12736?a+12|0:0)|0}function nd(a){a=a|0;oi(a);return}function od(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0;c[a>>2]=3976;b=a+312|0;d=c[b>>2]|0;if(d|0){e=a+316|0;f=c[e>>2]|0;if((f|0)==(d|0))g=d;else{h=f;do{f=c[h+-4>>2]|0;h=h+-8|0;if(f|0?(i=f+4|0,j=c[i>>2]|0,c[i>>2]=j+-1,(j|0)==0):0){Pa[c[(c[f>>2]|0)+8>>2]&255](f);mi(f)}}while((h|0)!=(d|0));g=c[b>>2]|0}c[e>>2]=d;oi(g)}g=c[a+308>>2]|0;if(g|0?(d=g+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){Pa[c[(c[g>>2]|0)+8>>2]&255](g);mi(g)}g=c[a+296>>2]|0;if((a+280|0)!=(g|0)){if(g|0)Pa[c[(c[g>>2]|0)+20>>2]&255](g)}else Pa[c[(c[g>>2]|0)+16>>2]&255](g);g=c[a+272>>2]|0;if((a+256|0)!=(g|0)){if(g|0)Pa[c[(c[g>>2]|0)+20>>2]&255](g)}else Pa[c[(c[g>>2]|0)+16>>2]&255](g);g=c[a+248>>2]|0;if((a+232|0)!=(g|0)){if(g|0)Pa[c[(c[g>>2]|0)+20>>2]&255](g)}else Pa[c[(c[g>>2]|0)+16>>2]&255](g);g=c[a+216>>2]|0;if((a+200|0)!=(g|0)){if(g|0)Pa[c[(c[g>>2]|0)+20>>2]&255](g)}else Pa[c[(c[g>>2]|0)+16>>2]&255](g);g=c[a+192>>2]|0;if((a+176|0)!=(g|0)){if(g|0)Pa[c[(c[g>>2]|0)+20>>2]&255](g)}else Pa[c[(c[g>>2]|0)+16>>2]&255](g);g=c[a+168>>2]|0;if((a+152|0)!=(g|0)){if(g|0)Pa[c[(c[g>>2]|0)+20>>2]&255](g)}else Pa[c[(c[g>>2]|0)+16>>2]&255](g);g=c[a+136>>2]|0;if((a+120|0)!=(g|0)){if(g|0)Pa[c[(c[g>>2]|0)+20>>2]&255](g)}else Pa[c[(c[g>>2]|0)+16>>2]&255](g);g=c[a+112>>2]|0;if((a+96|0)!=(g|0)){if(g|0)Pa[c[(c[g>>2]|0)+20>>2]&255](g)}else Pa[c[(c[g>>2]|0)+16>>2]&255](g);g=c[a+88>>2]|0;if((a+72|0)==(g|0)){Pa[c[(c[g>>2]|0)+16>>2]&255](g);return}if(!g)return;Pa[c[(c[g>>2]|0)+20>>2]&255](g);return}function pd(a){a=a|0;oi(a);return}function qd(a){a=a|0;var b=0;b=ni(8)|0;c[b>>2]=4508;c[b+4>>2]=c[a+4>>2];return b|0}function rd(a,b){a=a|0;b=b|0;c[b>>2]=4508;c[b+4>>2]=c[a+4>>2];return}function sd(a){a=a|0;return}function td(a){a=a|0;oi(a);return}function ud(a,b,d,e,f){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;yd(a+4|0,c[b>>2]|0,c[d>>2]|0,c[e>>2]|0,c[f>>2]|0);return}function vd(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==12950?a+4|0:0)|0}function wd(a){a=a|0;return 3184}function xd(a){a=a|0;return}function yd(a,b,d,e,f){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0;g=c[a>>2]|0;a=c[g+76>>2]|0;h=c[g+64>>2]|0;i=gj(b,2808,2848,0)|0;b=g+4|0;g=c[b>>2]|0;j=(c[g+((c[i+4>>2]|0)*48|0)+32>>2]|0)+1|0;switch(c[g+(j*48|0)+44>>2]|0){case 7:case 5:case 4:{k=g+(j*48|0)+36|0;l=4;break}case 8:{k=g+(j*48|0)+32|0;l=4;break}default:{}}if((l|0)==4)c[k>>2]=f;if(!((d>>>0)%((c[h+(a*80|0)+12>>2]|0)>>>0)|0))m=((e>>>0)%((c[h+(a*80|0)+8>>2]|0)>>>0)|0|0)==0?255:0;else m=0;a=c[i+312>>2]|0;i=gj(c[a>>2]|0,2808,3120,0)|0;h=c[a+4>>2]|0;if(!h){n=0;o=g}else{g=h+4|0;c[g>>2]=(c[g>>2]|0)+1;n=h;o=c[b>>2]|0}c[o+(((c[o+((c[i+4>>2]|0)*48|0)+32>>2]|0)+1|0)*48|0)+32>>2]=m;if(!n)return;m=n+4|0;i=c[m>>2]|0;c[m>>2]=i+-1;if(i|0)return;Pa[c[(c[n>>2]|0)+8>>2]&255](n);mi(n);return}function zd(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0;h=Ia;Ia=Ia+16|0;if((Ia|0)>=(Ja|0))B(16);i=h+8|0;j=h;c[b>>2]=0;k=b+4|0;c[k>>2]=0;l=b+8|0;c[l>>2]=0;if(!e){Ia=h;return}m=g+16|0;g=j+4|0;n=i+4|0;o=0;while(1){p=c[m>>2]|0;if(!p){q=5;break}Ra[c[(c[p>>2]|0)+24>>2]&31](i,p);p=c[i>>2]|0;a[p+65>>0]=0;a[p+145>>0]=0;a[p+225>>0]=0;c[(c[d>>2]|0)+((c[p+4>>2]|0)*48|0)+40>>2]=0;r=c[k>>2]|0;if((r|0)==(c[l>>2]|0))xb(b,i);else{c[r>>2]=p;p=c[n>>2]|0;c[r+4>>2]=p;if(!p)s=r;else{r=p+4|0;c[r>>2]=(c[r>>2]|0)+1;s=c[k>>2]|0}c[k>>2]=s+8}r=c[(c[f>>2]|0)+4>>2]|0;c[j>>2]=c[i>>2];p=c[n>>2]|0;c[g>>2]=p;if(p|0){t=p+4|0;c[t>>2]=(c[t>>2]|0)+1}Ta[r&3](f,d,j);r=c[g>>2]|0;if(r|0?(t=r+4|0,p=c[t>>2]|0,c[t>>2]=p+-1,(p|0)==0):0){Pa[c[(c[r>>2]|0)+8>>2]&255](r);mi(r)}r=c[n>>2]|0;if(r|0?(p=r+4|0,t=c[p>>2]|0,c[p>>2]=t+-1,(t|0)==0):0){Pa[c[(c[r>>2]|0)+8>>2]&255](r);mi(r)}o=o+1|0;if(o>>>0>=e>>>0){q=3;break}}if((q|0)==3){Ia=h;return}else if((q|0)==5){q=da(4)|0;c[q>>2]=6096;ha(q|0,3736,117)}}function Ad(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0;d=a+4|0;e=c[a>>2]|0;f=((c[d>>2]|0)-e|0)/12|0;g=f+1|0;if(g>>>0>357913941)Si(a);h=a+8|0;i=((c[h>>2]|0)-e|0)/12|0;e=i<<1;j=i>>>0<178956970?(e>>>0<g>>>0?g:e):357913941;do if(j)if(j>>>0>357913941){e=da(8)|0;ti(e,10959);c[e>>2]=6220;ha(e|0,3864,124)}else{k=ni(j*12|0)|0;break}else k=0;while(0);e=k+(f*12|0)|0;g=k+(j*12|0)|0;c[e>>2]=c[b>>2];j=b+4|0;c[k+(f*12|0)+4>>2]=c[j>>2];i=b+8|0;c[k+(f*12|0)+8>>2]=c[i>>2];c[i>>2]=0;c[j>>2]=0;c[b>>2]=0;b=e+12|0;j=c[a>>2]|0;i=c[d>>2]|0;if((i|0)==(j|0)){l=e;m=j;n=j}else{f=i;i=e;do{e=i;i=i+-12|0;k=f;f=f+-12|0;c[i>>2]=0;o=e+-8|0;c[o>>2]=0;p=e+-4|0;c[p>>2]=0;c[i>>2]=c[f>>2];e=k+-8|0;c[o>>2]=c[e>>2];o=k+-4|0;c[p>>2]=c[o>>2];c[o>>2]=0;c[e>>2]=0;c[f>>2]=0}while((f|0)!=(j|0));l=i;m=c[a>>2]|0;n=c[d>>2]|0}c[a>>2]=l;c[d>>2]=b;c[h>>2]=g;g=m;if((n|0)!=(g|0)){h=n;do{n=h;h=h+-12|0;b=c[h>>2]|0;if(b|0){d=n+-8|0;n=c[d>>2]|0;if((n|0)==(b|0))q=b;else{l=n;do{n=c[l+-4>>2]|0;l=l+-8|0;if(n|0?(a=n+4|0,i=c[a>>2]|0,c[a>>2]=i+-1,(i|0)==0):0){Pa[c[(c[n>>2]|0)+8>>2]&255](n);mi(n)}}while((l|0)!=(b|0));q=c[h>>2]|0}c[d>>2]=b;oi(q)}}while((h|0)!=(g|0))}if(!m)return;oi(m);return}function Bd(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0;d=a+4|0;e=c[d>>2]|0;f=c[a>>2]|0;g=e-f>>3;h=g+1|0;i=f;j=e;if(h>>>0>536870911)Si(a);e=a+8|0;k=(c[e>>2]|0)-f|0;l=k>>2;m=k>>3>>>0<268435455?(l>>>0<h>>>0?h:l):536870911;do if(m)if(m>>>0>536870911){l=da(8)|0;ti(l,10959);c[l>>2]=6220;ha(l|0,3864,124)}else{n=ni(m<<3)|0;break}else n=0;while(0);l=n+(g<<3)|0;h=n+(m<<3)|0;c[l>>2]=c[b>>2];m=b+4|0;c[n+(g<<3)+4>>2]=c[m>>2];c[b>>2]=0;c[m>>2]=0;m=l+8|0;if((j|0)==(i|0)){o=l;p=i;q=f}else{b=g+-1-((j+-8+(0-f)|0)>>>3)|0;f=j;j=l;do{l=j;j=j+-8|0;g=f;f=f+-8|0;c[j>>2]=c[f>>2];k=g+-4|0;c[l+-4>>2]=c[k>>2];c[f>>2]=0;c[k>>2]=0}while((f|0)!=(i|0));i=c[a>>2]|0;o=n+(b<<3)|0;p=i;q=i}c[a>>2]=o;o=c[d>>2]|0;c[d>>2]=m;c[e>>2]=h;if((o|0)!=(p|0)){h=o;do{o=c[h+-4>>2]|0;h=h+-8|0;if(o|0?(e=o+4|0,m=c[e>>2]|0,c[e>>2]=m+-1,(m|0)==0):0){Pa[c[(c[o>>2]|0)+8>>2]&255](o);mi(o)}}while((h|0)!=(p|0))}if(!q)return;oi(q);return}function Cd(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;d=Ia;Ia=Ia+16|0;if((Ia|0)>=(Ja|0))B(16);e=d;c[a>>2]=b;f=ni(16)|0;c[f+4>>2]=0;c[f+8>>2]=0;c[f>>2]=4576;c[f+12>>2]=b;c[a+4>>2]=f;c[e>>2]=b;c[e+4>>2]=b;Dd(a,e);Ia=d;return}function Dd(a,b){a=a|0;b=b|0;return}function Ed(a){a=a|0;li(a);oi(a);return}function Fd(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0;b=c[a+12>>2]|0;if(!b)return;a=c[b>>2]|0;if(a|0){d=b+4|0;e=c[d>>2]|0;if((e|0)==(a|0))f=a;else{g=e;do{e=c[g+-4>>2]|0;g=g+-8|0;if(e|0?(h=e+4|0,i=c[h>>2]|0,c[h>>2]=i+-1,(i|0)==0):0){Pa[c[(c[e>>2]|0)+8>>2]&255](e);mi(e)}}while((g|0)!=(a|0));f=c[b>>2]|0}c[d>>2]=a;oi(f)}oi(b);return}function Gd(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==13099?a+12|0:0)|0}function Hd(a){a=a|0;oi(a);return}function Id(a){a=a|0;var b=0;c[a>>2]=4604;b=c[a+32>>2]|0;if((a+16|0)==(b|0)){Pa[c[(c[b>>2]|0)+16>>2]&255](b);return}if(!b)return;Pa[c[(c[b>>2]|0)+20>>2]&255](b);return}function Jd(a){a=a|0;var b=0;c[a>>2]=4604;b=c[a+32>>2]|0;if((a+16|0)==(b|0)){Pa[c[(c[b>>2]|0)+16>>2]&255](b);oi(a);return}if(!b){oi(a);return}Pa[c[(c[b>>2]|0)+20>>2]&255](b);oi(a);return}function Kd(a){a=a|0;var b=0,d=0,e=0;b=ni(40)|0;c[b>>2]=4604;c[b+8>>2]=c[a+8>>2];d=b+16|0;e=c[a+32>>2]|0;if(!e){c[b+32>>2]=0;return b|0}if((a+16|0)==(e|0)){c[b+32>>2]=d;Ra[c[(c[e>>2]|0)+12>>2]&31](e,d);return b|0}else{c[b+32>>2]=La[c[(c[e>>2]|0)+8>>2]&63](e)|0;return b|0}return 0}function Ld(a,b){a=a|0;b=b|0;var d=0,e=0,f=0;c[b>>2]=4604;c[b+8>>2]=c[a+8>>2];d=b+16|0;e=a+32|0;f=c[e>>2]|0;if(!f){c[b+32>>2]=0;return}if((a+16|0)==(f|0)){c[b+32>>2]=d;a=c[e>>2]|0;Ra[c[(c[a>>2]|0)+12>>2]&31](a,d);return}else{c[b+32>>2]=La[c[(c[f>>2]|0)+8>>2]&63](f)|0;return}}function Md(a){a=a|0;var b=0;b=c[a+32>>2]|0;if((a+16|0)==(b|0)){Pa[c[(c[b>>2]|0)+16>>2]&255](b);return}if(!b)return;Pa[c[(c[b>>2]|0)+20>>2]&255](b);return}function Nd(a){a=a|0;var b=0;b=c[a+32>>2]|0;if((a+16|0)==(b|0)){Pa[c[(c[b>>2]|0)+16>>2]&255](b);oi(a);return}if(!b){oi(a);return}Pa[c[(c[b>>2]|0)+20>>2]&255](b);oi(a);return}function Od(a,b){a=a|0;b=b|0;var d=0,e=0;d=Ia;Ia=Ia+16|0;if((Ia|0)>=(Ja|0))B(16);e=d;Rd(e,b+8|0);c[a>>2]=c[e>>2];c[a+4>>2]=c[e+4>>2];Ia=d;return}function Pd(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==13770?a+8|0:0)|0}function Qd(a){a=a|0;return 3312}function Rd(d,e){d=d|0;e=e|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0;h=Ia;Ia=Ia+48|0;if((Ia|0)>=(Ja|0))B(48);i=h+32|0;j=h;k=h+28|0;l=h+16|0;m=h+24|0;n=h+8|0;o=ni(352)|0;jb(o,c[e>>2]|0);c[o>>2]=4648;p=o+324|0;c[o+340>>2]=0;c[o+344>>2]=0;c[p>>2]=0;c[p+4>>2]=0;c[p+8>>2]=0;a[p+12>>0]=0;c[k>>2]=0;c[i>>2]=c[k>>2];Sd(d,o,i);o=ni(296)|0;k=c[d>>2]|0;p=c[d+4>>2]|0;q=(p|0)==0;if(!q){r=p+4|0;c[r>>2]=(c[r>>2]|0)+1}a[o+4>>0]=0;a[o+5>>0]=0;c[o+24>>2]=0;c[o>>2]=4700;a[o+32>>0]=0;c[o+36>>2]=k;c[o+40>>2]=p;if(!q){k=p+4|0;c[k>>2]=(c[k>>2]|0)+1}b[o+44>>1]=0;a[o+48>>0]=1;f[o+52>>2]=1.0000000474974513e-03;g[o+56>>3]=1.0;g[o+64>>3]=18.84955592153876;k=o+72|0;c[k>>2]=0;c[k+4>>2]=0;c[k+8>>2]=0;c[k+12>>2]=0;a[o+88>>0]=1;f[o+92>>2]=1.0000000474974513e-03;g[o+96>>3]=1.0;g[o+104>>3]=18.84955592153876;k=o+112|0;c[k>>2]=0;c[k+4>>2]=0;c[k+8>>2]=0;c[k+12>>2]=0;a[o+128>>0]=1;f[o+132>>2]=1.0000000474974513e-03;g[o+136>>3]=1.0;g[o+144>>3]=18.84955592153876;k=o+152|0;c[k>>2]=0;c[k+4>>2]=0;c[k+8>>2]=0;c[k+12>>2]=0;a[o+168>>0]=1;f[o+172>>2]=1.0000000474974513e-03;g[o+176>>3]=1.0;g[o+184>>3]=18.84955592153876;k=o+192|0;c[k>>2]=0;c[k+4>>2]=0;c[k+8>>2]=0;c[k+12>>2]=0;a[o+208>>0]=1;f[o+212>>2]=1.0000000474974513e-03;g[o+216>>3]=1.0;g[o+224>>3]=18.84955592153876;k=o+232|0;c[k>>2]=0;c[k+4>>2]=0;c[k+8>>2]=0;c[k+12>>2]=0;a[o+248>>0]=1;g[o+256>>3]=1.0;g[o+264>>3]=18.84955592153876;g[o+272>>3]=.009999999776482582;g[o+280>>3]=0.0;f[o+288>>2]=0.0;c[m>>2]=0;c[i>>2]=c[m>>2];Td(l,o,i);if(!q?(q=p+4|0,o=c[q>>2]|0,c[q>>2]=o+-1,(o|0)==0):0){Pa[c[(c[p>>2]|0)+8>>2]&255](p);mi(p)}p=c[d>>2]|0;o=c[l>>2]|0;q=l+4|0;l=c[q>>2]|0;if(l|0){m=l+4|0;c[m>>2]=(c[m>>2]|0)+1}c[p+304>>2]=o;o=p+308|0;p=c[o>>2]|0;c[o>>2]=l;if(p|0?(l=p+4|0,o=c[l>>2]|0,c[l>>2]=o+-1,(o|0)==0):0){Pa[c[(c[p>>2]|0)+8>>2]&255](p);mi(p)}p=c[e+24>>2]|0;if(!p){o=da(4)|0;c[o>>2]=6096;ha(o|0,3736,117)}o=La[c[(c[p>>2]|0)+24>>2]&63](p)|0;c[i>>2]=o;p=ni(16)|0;c[p+4>>2]=0;c[p+8>>2]=0;c[p>>2]=4e3;c[p+12>>2]=o;l=i+4|0;c[l>>2]=p;c[j>>2]=o;c[j+4>>2]=o;zb(i,j);j=c[i>>2]|0;c[i>>2]=0;i=c[l>>2]|0;l=c[j+4>>2]|0;o=c[c[e>>2]>>2]|0;c[o+(l*48|0)+8>>2]=1065353216;c[o+(l*48|0)+12>>2]=1065353216;l=c[d>>2]|0;o=i;p=(i|0)==0;if(!p){m=o+4|0;c[m>>2]=(c[m>>2]|0)+1}c[l+340>>2]=j;m=l+344|0;l=c[m>>2]|0;c[m>>2]=i;if(l|0?(m=l+4|0,k=c[m>>2]|0,c[m>>2]=k+-1,(k|0)==0):0){Pa[c[(c[l>>2]|0)+8>>2]&255](l);mi(l)}l=c[d>>2]|0;d=c[(c[l>>2]|0)+4>>2]|0;k=c[e>>2]|0;c[n>>2]=j;j=n+4|0;c[j>>2]=o;if(!p){e=o+4|0;c[e>>2]=(c[e>>2]|0)+1}Ta[d&3](l,k,n);n=c[j>>2]|0;if(n|0?(j=n+4|0,k=c[j>>2]|0,c[j>>2]=k+-1,(k|0)==0):0){Pa[c[(c[n>>2]|0)+8>>2]&255](n);mi(n)}if(!p?(p=o+4|0,n=c[p>>2]|0,c[p>>2]=n+-1,(n|0)==0):0){Pa[c[(c[i>>2]|0)+8>>2]&255](o);mi(o)}o=c[q>>2]|0;if(!o){Ia=h;return}q=o+4|0;i=c[q>>2]|0;c[q>>2]=i+-1;if(i|0){Ia=h;return}Pa[c[(c[o>>2]|0)+8>>2]&255](o);mi(o);Ia=h;return}function Sd(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;d=Ia;Ia=Ia+16|0;if((Ia|0)>=(Ja|0))B(16);e=d;c[a>>2]=b;f=ni(16)|0;c[f+4>>2]=0;c[f+8>>2]=0;c[f>>2]=4672;c[f+12>>2]=b;c[a+4>>2]=f;c[e>>2]=b;c[e+4>>2]=b;Ud(a,e);Ia=d;return}function Td(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;d=Ia;Ia=Ia+16|0;if((Ia|0)>=(Ja|0))B(16);e=d;c[a>>2]=b;f=ni(16)|0;c[f+4>>2]=0;c[f+8>>2]=0;c[f>>2]=4712;c[f+12>>2]=b;c[a+4>>2]=f;c[e>>2]=b;c[e+4>>2]=b;ae(a,e);Ia=d;return}function Ud(a,b){a=a|0;b=b|0;return}function Vd(a){a=a|0;li(a);oi(a);return}function Wd(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b)return;c[b>>2]=4648;di(16333)|0;a=c[b+344>>2]|0;if(a|0?(d=a+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){Pa[c[(c[a>>2]|0)+8>>2]&255](a);mi(a)}od(b);oi(b);return}function Xd(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==13506?a+12|0:0)|0}function Yd(a){a=a|0;oi(a);return}function Zd(d,e,f){d=d|0;e=e|0;f=+f;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0.0,C=0,D=0,E=0;g=Ia;Ia=Ia+32|0;if((Ia|0)>=(Ja|0))B(32);h=g+16|0;i=g+8|0;j=g;k=d+44|0;l=b[k>>1]|0;if(!(l&1))m=l;else{l=d+36|0;n=(c[e>>2]|0)+((c[(c[l>>2]|0)+4>>2]|0)*48|0)|0;o=c[n+4>>2]|0;p=i;c[p>>2]=c[n>>2];c[p+4>>2]=o;o=d+48|0;_d(j,o,f,i);p=j;n=c[p+4>>2]|0;q=(c[e>>2]|0)+((c[(c[l>>2]|0)+4>>2]|0)*48|0)|0;c[q>>2]=c[p>>2];c[q+4>>2]=n;n=b[k>>1]|0;if(!(a[o>>0]|0))r=n;else{o=n&-2;b[k>>1]=o;r=o}m=r}if(!(m&2))s=m;else{m=d+36|0;r=(c[e>>2]|0)+((c[(c[m>>2]|0)+4>>2]|0)*48|0)+8|0;o=c[r+4>>2]|0;n=i;c[n>>2]=c[r>>2];c[n+4>>2]=o;o=d+88|0;_d(j,o,f,i);n=j;r=c[n+4>>2]|0;q=(c[e>>2]|0)+((c[(c[m>>2]|0)+4>>2]|0)*48|0)+8|0;c[q>>2]=c[n>>2];c[q+4>>2]=r;r=b[k>>1]|0;if(!(a[o>>0]|0))t=r;else{o=r&-3;b[k>>1]=o;t=o}s=t}if(!(s&4))u=s;else{s=d+36|0;t=(c[e>>2]|0)+((c[(c[s>>2]|0)+4>>2]|0)*48|0)+16|0;o=c[t+4>>2]|0;r=i;c[r>>2]=c[t>>2];c[r+4>>2]=o;o=d+128|0;_d(j,o,f,i);r=j;t=c[r+4>>2]|0;q=(c[e>>2]|0)+((c[(c[s>>2]|0)+4>>2]|0)*48|0)+16|0;c[q>>2]=c[r>>2];c[q+4>>2]=t;t=b[k>>1]|0;if(!(a[o>>0]|0))v=t;else{o=t&-5;b[k>>1]=o;v=o}u=v}if(!(u&8))w=u;else{u=d+36|0;v=(c[e>>2]|0)+((c[(c[u>>2]|0)+4>>2]|0)*48|0)+24|0;o=c[v+4>>2]|0;t=i;c[t>>2]=c[v>>2];c[t+4>>2]=o;o=d+168|0;_d(j,o,f,i);t=j;v=c[t+4>>2]|0;q=(c[e>>2]|0)+((c[(c[u>>2]|0)+4>>2]|0)*48|0)+24|0;c[q>>2]=c[t>>2];c[q+4>>2]=v;v=b[k>>1]|0;if(!(a[o>>0]|0))x=v;else{o=v&-9;b[k>>1]=o;x=o}w=x}if(!(w&16))y=w;else{w=d+36|0;x=(c[w>>2]|0)+8|0;o=c[x+4>>2]|0;v=i;c[v>>2]=c[x>>2];c[v+4>>2]=o;o=d+208|0;_d(j,o,f,i);i=j;j=c[i+4>>2]|0;v=(c[w>>2]|0)+8|0;c[v>>2]=c[i>>2];c[v+4>>2]=j;j=b[k>>1]|0;if(!(a[o>>0]|0))z=j;else{o=j&-17;b[k>>1]=o;z=o}y=z}if(y&32){z=d+36|0;o=d+248|0;A=+$d(o,f,+((c[(c[z>>2]|0)+32>>2]|0)>>>0)/255.0);f=A;j=A>1.0?255:~~((f<0.0?0.0:f)*255.0)>>>0;v=c[z>>2]|0;z=v+32|0;c[z>>2]=j;i=c[v+4>>2]|0;v=c[e>>2]|0;w=c[v+(i*48|0)+36>>2]|0;a:do if(i>>>0<=w>>>0){x=i;q=j;t=v;while(1){if(q>>>0>255){c[h>>2]=q;bi(13610,h)|0}switch(c[t+(x*48|0)+44>>2]|0){case 7:case 5:case 4:{C=t+(x*48|0)+36|0;D=29;break}case 8:{C=t+(x*48|0)+32|0;D=29;break}default:{}}if((D|0)==29){D=0;c[C>>2]=(c[C>>2]&-256)+q}u=x+1|0;if(u>>>0>w>>>0)break a;x=u;q=c[z>>2]|0;t=c[e>>2]|0}}while(0);z=b[k>>1]|0;if(!(a[o>>0]|0))E=z;else{o=z&-33;b[k>>1]=o;E=o}}else E=y;y=d+4|0;o=a[y>>0]|0;k=E<<16>>16==0;a[y>>0]=k&1;if(!(o<<24>>24==0&k)){Ia=g;return}if(!(a[d+32>>0]|0)){Ia=g;return}k=c[d+36>>2]|0;a[k+65>>0]=0;a[k+145>>0]=0;a[k+225>>0]=0;c[(c[e>>2]|0)+((c[k+4>>2]|0)*48|0)+40>>2]=0;Ia=g;return}function _d(b,d,e,h){b=b|0;d=d|0;e=+e;h=h|0;var i=0.0,j=0,k=0.0,l=0.0,m=0.0,n=0.0,o=0.0,p=0.0,q=0,r=0.0,t=0.0,v=0.0,w=0.0,x=0.0,y=0;i=e/1.0e3;j=d+32|0;e=+f[j>>2];k=+f[h>>2]-e;l=+f[d+36>>2];m=+f[h+4>>2]-l;n=+g[d+16>>3];o=+u(+(+g[d+8>>3]*-i*n));h=d+24|0;p=+f[h>>2];q=d+28|0;r=+f[q>>2];t=n*i;v=t+1.0;w=o;o=e+(i*p+k*v)*w;x=l+(i*r+m*v)*w;v=t;t=n;n=(p-(p+k*t)*v)*w;k=(r-(m*t+r)*v)*w;w=+s(+(o-e));e=+f[d+4>>2];if((w<e?+s(+n)<e&+s(+(x-l))<e:0)?i>0.0&+s(+k)<e:0){c[h>>2]=0;c[q>>2]=0;a[d>>0]=1;d=j;j=c[d+4>>2]|0;y=b;c[y>>2]=c[d>>2];c[y+4>>2]=j;return}f[h>>2]=n;f[q>>2]=k;f[b>>2]=o;f[b+4>>2]=x;return}function $d(b,c,d){b=b|0;c=+c;d=+d;var e=0,h=0,i=0.0,j=0,k=0.0,l=0.0,m=0.0,n=0,o=0.0,p=0.0,q=0.0,r=0.0,t=0.0,v=0.0;e=Ia;Ia=Ia+32|0;if((Ia|0)>=(Ja|0))B(32);h=e;i=c/1.0e3;j=b+40|0;c=+f[j>>2];k=d-c;l=+g[b+16>>3];m=+u(+-(i*+g[b+8>>3]*l));n=b+32|0;o=+g[n>>3];p=i*l;q=m*(i*o+(p+1.0)*k)+c;r=m*(o-p*(l*k+o));if(d>1.0|(d<0.0|(q>1.0|q<0.0))){g[h>>3]=q;g[h+8>>3]=d;g[h+16>>3]=o;g[h+24>>3]=i;bi(13568,h)|0;t=+f[j>>2]}else t=c;c=+s(+(q-t));o=+g[b+24>>3];if(o>c?i>0.0&+s(+r)<o:0){g[n>>3]=0.0;a[b>>0]=1;v=t;Ia=e;return +v}g[n>>3]=r;v=q;Ia=e;return +v}function ae(a,b){a=a|0;b=b|0;return}function be(a){a=a|0;li(a);oi(a);return}function ce(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b)return;c[b>>2]=4700;a=c[b+40>>2]|0;if(a|0?(d=a+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){Pa[c[(c[a>>2]|0)+8>>2]&255](a);mi(a)}c[b>>2]=4372;a=c[b+24>>2]|0;if((b+8|0)!=(a|0)){if(a|0)Pa[c[(c[a>>2]|0)+20>>2]&255](a)}else Pa[c[(c[a>>2]|0)+16>>2]&255](a);oi(b);return}function de(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==13724?a+12|0:0)|0}function ee(a){a=a|0;oi(a);return}function fe(a,b){a=a|0;b=b|0;return}function ge(a){a=a|0;li(a);oi(a);return}function he(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;ke(b);oi(b);return}function ie(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==13997?a+12|0:0)|0}function je(a){a=a|0;oi(a);return}function ke(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0;c[a>>2]=4552;b=a+424|0;d=c[b>>2]|0;if(d|0){e=a+428|0;f=c[e>>2]|0;if((f|0)==(d|0))g=d;else{h=f;do{f=h;h=h+-12|0;i=c[h>>2]|0;if(i|0){j=f+-8|0;f=c[j>>2]|0;if((f|0)==(i|0))k=i;else{l=f;do{f=c[l+-4>>2]|0;l=l+-8|0;if(f|0?(m=f+4|0,n=c[m>>2]|0,c[m>>2]=n+-1,(n|0)==0):0){Pa[c[(c[f>>2]|0)+8>>2]&255](f);mi(f)}}while((l|0)!=(i|0));k=c[h>>2]|0}c[j>>2]=i;oi(k)}}while((h|0)!=(d|0));g=c[b>>2]|0}c[e>>2]=d;oi(g)}g=c[a+420>>2]|0;if(g|0?(d=g+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){Pa[c[(c[g>>2]|0)+8>>2]&255](g);mi(g)}g=c[a+408>>2]|0;if((a+392|0)!=(g|0)){if(g|0)Pa[c[(c[g>>2]|0)+20>>2]&255](g)}else Pa[c[(c[g>>2]|0)+16>>2]&255](g);g=c[a+384>>2]|0;if((a+368|0)!=(g|0)){if(g|0)Pa[c[(c[g>>2]|0)+20>>2]&255](g)}else Pa[c[(c[g>>2]|0)+16>>2]&255](g);g=c[a+360>>2]|0;if((a+344|0)==(g|0)){Pa[c[(c[g>>2]|0)+16>>2]&255](g);od(a);return}if(!g){od(a);return}Pa[c[(c[g>>2]|0)+20>>2]&255](g);od(a);return}function le(a,b){a=a|0;b=b|0;return}function me(a,b,d,e,g,h){a=a|0;b=b|0;d=d|0;e=e|0;g=g|0;h=h|0;var i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0.0;i=Ia;Ia=Ia+32|0;if((Ia|0)>=(Ja|0))B(32);j=i;k=i+20|0;l=i+16|0;m=i+12|0;n=i+8|0;if(!((c[b+336>>2]|0)>>>0>e>>>0?(c[b+332>>2]|0)>>>0>g>>>0:0)){c[j>>2]=e;c[j+4>>2]=g;bi(12255,j)|0}j=c[b+416>>2]|0;o=c[j>>2]|0;p=c[j+4>>2]|0;a:do if((o|0)!=(p|0)){j=o;while(1){q=c[j>>2]|0;r=c[j+4>>2]|0;s=(r|0)==0;if(!s){t=r+4|0;c[t>>2]=(c[t>>2]|0)+1}u=(c[d>>2]|0)+((c[q+4>>2]|0)*48|0)+40|0;if(!(c[u>>2]|0))break;if(!s?(s=r+4|0,t=c[s>>2]|0,c[s>>2]=t+-1,(t|0)==0):0){Pa[c[(c[r>>2]|0)+8>>2]&255](r);mi(r)}j=j+8|0;if((j|0)==(p|0)){v=13;break a}}c[u>>2]=1;j=gj(q,2808,3248,0)|0;if(!j){c[a>>2]=0;c[a+4>>2]=0;if(!r)break;w=r+4|0}else{c[a>>2]=j;c[a+4>>2]=r;if(!r)break;j=r+4|0;c[j>>2]=(c[j>>2]|0)+1;w=j}j=c[w>>2]|0;c[w>>2]=j+-1;if(!j){Pa[c[(c[r>>2]|0)+8>>2]&255](r);mi(r)}}else v=13;while(0);if((v|0)==13){c[a>>2]=0;c[a+4>>2]=0}v=c[a>>2]|0;c[v+324>>2]=e;c[v+328>>2]=g;c[v+332>>2]=h;r=a+4|0;w=c[r>>2]|0;q=(w|0)==0;if(!q){u=w+4|0;c[u>>2]=(c[u>>2]|0)+1}u=b+440|0;p=b+444|0;o=c[p>>2]|0;j=v+4|0;v=c[j>>2]|0;t=c[d>>2]|0;c[t+(v*48|0)+8>>2]=c[u>>2];c[t+(v*48|0)+12>>2]=o;x=+f[p>>2]*+(e|0)+ +f[b+452>>2]*+(e+1|0);p=c[j>>2]|0;o=c[d>>2]|0;f[o+(p*48|0)>>2]=+f[u>>2]*+(g|0)+ +f[b+448>>2]*+(g+1|0);f[o+(p*48|0)+4>>2]=x;p=c[j>>2]|0;j=c[d>>2]|0;c[j+(p*48|0)+16>>2]=0;c[j+(p*48|0)+20>>2]=0;if(!q?(q=w+4|0,p=c[q>>2]|0,c[q>>2]=p+-1,(p|0)==0):0){Pa[c[(c[w>>2]|0)+8>>2]&255](w);mi(w)}w=c[(c[b+424>>2]|0)+(e*12|0)>>2]|0;p=c[a>>2]|0;q=c[r>>2]|0;if(q|0){r=q+4|0;c[r>>2]=(c[r>>2]|0)+1}c[w+(g<<3)>>2]=p;p=w+(g<<3)+4|0;w=c[p>>2]|0;c[p>>2]=q;if(w|0?(q=w+4|0,p=c[q>>2]|0,c[q>>2]=p+-1,(p|0)==0):0){Pa[c[(c[w>>2]|0)+8>>2]&255](w);mi(w)}c[k>>2]=c[(c[a>>2]|0)+340>>2];c[l>>2]=e;c[m>>2]=g;c[n>>2]=h;h=c[b+408>>2]|0;if(!h){b=da(4)|0;c[b>>2]=6096;ha(b|0,3736,117)}else{Va[c[(c[h>>2]|0)+24>>2]&7](h,k,l,m,n);Ia=i;return}}function ne(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0;g=Ia;Ia=Ia+32|0;if((Ia|0)>=(Ja|0))B(32);h=g;i=b+72|0;j=c[d+16>>2]|0;do if(j)if((d|0)==(j|0)){k=h+16|0;c[k>>2]=h;Ra[c[(c[j>>2]|0)+12>>2]&31](j,h);l=k;break}else{k=h+16|0;c[k>>2]=La[c[(c[j>>2]|0)+8>>2]&63](j)|0;l=k;break}else{k=h+16|0;c[k>>2]=0;l=k}while(0);pe(h,i);i=c[l>>2]|0;if((h|0)!=(i|0)){if(i|0)Pa[c[(c[i>>2]|0)+20>>2]&255](i)}else Pa[c[(c[i>>2]|0)+16>>2]&255](i);i=b+96|0;l=c[e+16>>2]|0;do if(l)if((e|0)==(l|0)){j=h+16|0;c[j>>2]=h;Ra[c[(c[l>>2]|0)+12>>2]&31](l,h);m=j;break}else{j=h+16|0;c[j>>2]=La[c[(c[l>>2]|0)+8>>2]&63](l)|0;m=j;break}else{j=h+16|0;c[j>>2]=0;m=j}while(0);dc(h,i);i=c[m>>2]|0;if((h|0)!=(i|0)){if(i|0)Pa[c[(c[i>>2]|0)+20>>2]&255](i)}else Pa[c[(c[i>>2]|0)+16>>2]&255](i);i=b+120|0;m=c[f+16>>2]|0;do if(m)if((f|0)==(m|0)){l=h+16|0;c[l>>2]=h;Ra[c[(c[m>>2]|0)+12>>2]&31](m,h);n=l;break}else{l=h+16|0;c[l>>2]=La[c[(c[m>>2]|0)+8>>2]&63](m)|0;n=l;break}else{l=h+16|0;c[l>>2]=0;n=l}while(0);dc(h,i);i=c[n>>2]|0;if((h|0)==(i|0)){Pa[c[(c[i>>2]|0)+16>>2]&255](i);o=b+64|0;a[o>>0]=1;Ia=g;return}if(!i){o=b+64|0;a[o>>0]=1;Ia=g;return}Pa[c[(c[i>>2]|0)+20>>2]&255](i);o=b+64|0;a[o>>0]=1;Ia=g;return}function oe(b,d){b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0;e=b+328|0;if((c[e>>2]|0)<=0)return;f=b+324|0;g=b+424|0;b=0;h=c[f>>2]|0;while(1){if((h|0)>0){i=0;do{j=c[(c[g>>2]|0)+(b*12|0)>>2]|0;k=c[j+(i<<3)>>2]|0;l=c[j+(i<<3)+4>>2]|0;j=(l|0)==0;if(!j){m=l+4|0;c[m>>2]=(c[m>>2]|0)+1}if((k|0?(a[k+65>>0]=0,a[k+145>>0]=0,a[k+225>>0]=0,c[(c[d>>2]|0)+((c[k+4>>2]|0)*48|0)+40>>2]=0,k=c[(c[g>>2]|0)+(b*12|0)>>2]|0,c[k+(i<<3)>>2]=0,m=k+(i<<3)+4|0,k=c[m>>2]|0,c[m>>2]=0,k|0):0)?(m=k+4|0,n=c[m>>2]|0,c[m>>2]=n+-1,(n|0)==0):0){Pa[c[(c[k>>2]|0)+8>>2]&255](k);mi(k)}if(!j?(j=l+4|0,k=c[j>>2]|0,c[j>>2]=k+-1,(k|0)==0):0){Pa[c[(c[l>>2]|0)+8>>2]&255](l);mi(l)}i=i+1|0;l=c[f>>2]|0}while((i|0)<(l|0));o=l}else o=h;b=b+1|0;if((b|0)>=(c[e>>2]|0))break;else h=o}return}function pe(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0;d=Ia;Ia=Ia+16|0;if((Ia|0)>=(Ja|0))B(16);e=d;if((b|0)==(a|0)){Ia=d;return}f=a+16|0;g=c[f>>2]|0;h=g;i=b+16|0;if((g|0)==(a|0))if((c[i>>2]|0)==(b|0)){Ra[c[(c[g>>2]|0)+12>>2]&31](g,e);j=c[f>>2]|0;Pa[c[(c[j>>2]|0)+16>>2]&255](j);c[f>>2]=0;j=c[i>>2]|0;Ra[c[(c[j>>2]|0)+12>>2]&31](j,a);j=c[i>>2]|0;Pa[c[(c[j>>2]|0)+16>>2]&255](j);c[i>>2]=0;c[f>>2]=a;Ra[c[(c[e>>2]|0)+12>>2]&31](e,b);Pa[c[(c[e>>2]|0)+16>>2]&255](e);c[i>>2]=b;Ia=d;return}else{Ra[c[(c[g>>2]|0)+12>>2]&31](g,b);g=c[f>>2]|0;Pa[c[(c[g>>2]|0)+16>>2]&255](g);g=b+16|0;c[f>>2]=c[g>>2];c[g>>2]=b;Ia=d;return}else{g=c[i>>2]|0;if((b|0)==(g|0)){Ra[c[(c[g>>2]|0)+12>>2]&31](g,a);b=c[i>>2]|0;Pa[c[(c[b>>2]|0)+16>>2]&255](b);c[i>>2]=c[f>>2];c[f>>2]=a;Ia=d;return}else{c[f>>2]=g;c[i>>2]=h;Ia=d;return}}}function qe(a){a=a|0;var b=0,d=0;c[a>>2]=4768;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Pa[c[(c[b>>2]|0)+8>>2]&255](b);mi(b);return}function re(a){a=a|0;var b=0,d=0,e=0;c[a>>2]=4768;b=c[a+12>>2]|0;if(!b){oi(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){oi(a);return}Pa[c[(c[b>>2]|0)+8>>2]&255](b);mi(b);oi(a);return}function se(a){a=a|0;var b=0,d=0;b=ni(16)|0;c[b>>2]=4768;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return b|0;a=d+4|0;c[a>>2]=(c[a>>2]|0)+1;return b|0}function te(a,b){a=a|0;b=b|0;var d=0;c[b>>2]=4768;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return;b=d+4|0;c[b>>2]=(c[b>>2]|0)+1;return}function ue(a){a=a|0;var b=0,d=0;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Pa[c[(c[b>>2]|0)+8>>2]&255](b);mi(b);return}function ve(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b){oi(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){oi(a);return}Pa[c[(c[b>>2]|0)+8>>2]&255](b);mi(b);oi(a);return}function we(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0;b=Ia;Ia=Ia+16|0;if((Ia|0)>=(Ja|0))B(16);d=b;e=c[a+4>>2]|0;f=c[e+56>>2]|0;c[d>>2]=c[a+8>>2];g=d+4|0;h=c[a+12>>2]|0;c[g>>2]=h;if(h|0){a=h+4|0;c[a>>2]=(c[a>>2]|0)+1}ze(f,e+4|0,d);d=c[g>>2]|0;if(!d){Ia=b;return}g=d+4|0;e=c[g>>2]|0;c[g>>2]=e+-1;if(e|0){Ia=b;return}Pa[c[(c[d>>2]|0)+8>>2]&255](d);mi(d);Ia=b;return}function xe(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==14210?a+4|0:0)|0}function ye(a){a=a|0;return 3352}function ze(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0;f=Ia;Ia=Ia+64|0;if((Ia|0)>=(Ja|0))B(64);g=f+8|0;h=f;i=c[e>>2]|0;j=c[e+4>>2]|0;k=j;if(j|0){l=j+4|0;c[l>>2]=(c[l>>2]|0)+1}l=b+336|0;if((c[l>>2]|0)>0){j=b+332|0;m=b+424|0;b=0;n=c[(c[d>>2]|0)+((c[(c[e>>2]|0)+4>>2]|0)*48|0)+32>>2]|0;o=i;p=k;q=c[j>>2]|0;while(1){if((q|0)>0){r=0;s=n;t=o;u=p;while(1){v=c[(c[m>>2]|0)+(b*12|0)>>2]|0;w=c[v+(r<<3)>>2]|0;x=c[v+(r<<3)+4>>2]|0;v=(x|0)==0;if(!v){y=x+4|0;c[y>>2]=(c[y>>2]|0)+1}if(((w|0)!=0?(a[w+336>>0]|0)==0:0)?(y=c[(c[d>>2]|0)+((c[w+4>>2]|0)*48|0)+32>>2]|0,y>>>0>s>>>0):0){z=x;if(!v){A=x+4|0;c[A>>2]=(c[A>>2]|0)+1}A=u;if((u|0)!=0?(C=A+4|0,D=c[C>>2]|0,c[C>>2]=D+-1,(D|0)==0):0){Pa[c[(c[u>>2]|0)+8>>2]&255](A);mi(A);E=y;F=w;G=z}else{E=y;F=w;G=z}}else{E=s;F=t;G=u}if(!v?(v=x+4|0,z=c[v>>2]|0,c[v>>2]=z+-1,(z|0)==0):0){Pa[c[(c[x>>2]|0)+8>>2]&255](x);mi(x)}r=r+1|0;x=c[j>>2]|0;if((r|0)>=(x|0)){H=E;I=F;J=G;K=x;break}else{s=E;t=F;u=G}}}else{H=n;I=o;J=p;K=q}b=b+1|0;if((b|0)>=(c[l>>2]|0)){L=e;M=I;N=J;break}else{n=H;o=I;p=J;q=K}}}else{L=e;M=i;N=k}k=M;i=c[k+328>>2]|0;c[h>>2]=c[k+324>>2];c[h+4>>2]=i;bi(14145,h)|0;h=c[L>>2]|0;L=M;M=c[h+4>>2]|0;i=c[d>>2]|0;k=c[i+(M*48|0)+32>>2]|0;e=c[i+(M*48|0)+36>>2]|0;M=c[L+4>>2]|0;K=c[i+(M*48|0)+32>>2]|0;q=c[i+(M*48|0)+36>>2]|0;c[g>>2]=h;c[g+4>>2]=L;c[g+8>>2]=k;c[g+12>>2]=e;c[g+16>>2]=K;c[g+20>>2]=q;bi(14164,g)|0;q=1-k+e|0;e=0;do{M=c[d>>2]|0;i=M+((e+k|0)*48|0)|0;J=M+((e+K|0)*48|0)|0;M=g;p=i;I=M+48|0;do{c[M>>2]=c[p>>2];M=M+4|0;p=p+4|0}while((M|0)<(I|0));M=i;p=J;I=M+48|0;do{c[M>>2]=c[p>>2];M=M+4|0;p=p+4|0}while((M|0)<(I|0));M=J;p=g;I=M+48|0;do{c[M>>2]=c[p>>2];M=M+4|0;p=p+4|0}while((M|0)<(I|0));e=e+1|0}while((e|0)!=(q|0));Ae(h,d,K);Ae(L,d,k);k=N;if(!N){Ia=f;return}d=k+4|0;L=c[d>>2]|0;c[d>>2]=L+-1;if(L|0){Ia=f;return}Pa[c[(c[N>>2]|0)+8>>2]&255](k);mi(k);Ia=f;return}function Ae(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0;e=a+4|0;f=d-(c[e>>2]|0)|0;c[e>>2]=d;e=c[b>>2]|0;c[e+(d*48|0)+32>>2]=d;g=e+(d*48|0)+36|0;c[g>>2]=(c[g>>2]|0)+f;g=c[a+312>>2]|0;d=c[a+316>>2]|0;if((g|0)==(d|0))return;a=g;do{g=c[a>>2]|0;e=c[a+4>>2]|0;if(e){h=e+4|0;c[h>>2]=(c[h>>2]|0)+1;Ae(g,b,(c[g+4>>2]|0)+f|0);h=e+4|0;i=c[h>>2]|0;c[h>>2]=i+-1;if(!i){Pa[c[(c[e>>2]|0)+8>>2]&255](e);mi(e)}}else Ae(g,b,(c[g+4>>2]|0)+f|0);a=a+8|0}while((a|0)!=(d|0));return}function Be(a){a=a|0;var b=0,d=0;c[a>>2]=4812;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Pa[c[(c[b>>2]|0)+8>>2]&255](b);mi(b);return}function Ce(a){a=a|0;var b=0,d=0,e=0;c[a>>2]=4812;b=c[a+12>>2]|0;if(!b){oi(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){oi(a);return}Pa[c[(c[b>>2]|0)+8>>2]&255](b);mi(b);oi(a);return}function De(a){a=a|0;var b=0,d=0;b=ni(16)|0;c[b>>2]=4812;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return b|0;a=d+4|0;c[a>>2]=(c[a>>2]|0)+1;return b|0}function Ee(a,b){a=a|0;b=b|0;var d=0;c[b>>2]=4812;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return;b=d+4|0;c[b>>2]=(c[b>>2]|0)+1;return}function Fe(a){a=a|0;var b=0,d=0;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Pa[c[(c[b>>2]|0)+8>>2]&255](b);mi(b);return}function Ge(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b){oi(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){oi(a);return}Pa[c[(c[b>>2]|0)+8>>2]&255](b);mi(b);oi(a);return}function He(a){a=a|0;Ke(a+4|0);return}function Ie(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==14409?a+4|0:0)|0}function Je(a){a=a|0;return 3376}function Ke(a){a=a|0;var b=0,d=0,e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0.0;b=Ia;Ia=Ia+16|0;if((Ia|0)>=(Ja|0))B(16);d=b;e=c[a>>2]|0;g=a+4|0;h=c[g>>2]|0;i=h+4|0;j=c[i>>2]|0;k=e+4|0;l=c[k>>2]|0;m=l+(j*48|0)|0;n=l+(j*48|0)+4|0;o=+f[l+(j*48|0)+20>>2]/+f[h+40>>2]+ +f[n>>2];f[m>>2]=+f[l+(j*48|0)+16>>2]/+f[h+36>>2]+ +f[m>>2];f[n>>2]=o;n=c[i>>2]|0;i=c[k>>2]|0;c[i+(n*48|0)+16>>2]=0;c[i+(n*48|0)+20>>2]=0;c[d>>2]=c[g>>2];g=d+4|0;n=c[a+8>>2]|0;c[g>>2]=n;if(n|0){a=n+4|0;c[a>>2]=(c[a>>2]|0)+1}Le(e,d);d=c[g>>2]|0;if(!d){Ia=b;return}g=d+4|0;e=c[g>>2]|0;c[g>>2]=e+-1;if(e|0){Ia=b;return}Pa[c[(c[d>>2]|0)+8>>2]&255](d);mi(d);Ia=b;return}function Le(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0;d=Ia;Ia=Ia+16|0;if((Ia|0)>=(Ja|0))B(16);e=d;f=c[a+56>>2]|0;c[e>>2]=c[b>>2];g=e+4|0;h=c[b+4>>2]|0;c[g>>2]=h;if(h|0){b=h+4|0;c[b>>2]=(c[b>>2]|0)+1}Me(f,a+4|0,e);e=c[g>>2]|0;if(e|0?(g=e+4|0,f=c[g>>2]|0,c[g>>2]=f+-1,(f|0)==0):0){Pa[c[(c[e>>2]|0)+8>>2]&255](e);mi(e)}if(!(Ne(a)|0)){Ia=d;return}c[(c[a+4>>2]|0)+((c[(c[a+48>>2]|0)+4>>2]|0)*48|0)+40>>2]=1;Ia=d;return}function Me(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,g=0,h=0,i=0,j=0,k=0;e=Ia;Ia=Ia+32|0;if((Ia|0)>=(Ja|0))B(32);g=e+8|0;h=e;c[h>>2]=c[d>>2];i=h+4|0;j=c[d+4>>2]|0;c[i>>2]=j;if(j|0){k=j+4|0;c[k>>2]=(c[k>>2]|0)+1}Oe(g,a,b,h);h=c[i>>2]|0;if(h|0?(i=h+4|0,k=c[i>>2]|0,c[i>>2]=k+-1,(k|0)==0):0){Pa[c[(c[h>>2]|0)+8>>2]&255](h);mi(h)}h=c[d>>2]|0;d=c[h+324>>2]|0;k=c[h+328>>2]|0;if(+f[h+24>>2]*1.5*.5>+f[g+8>>2]){h=c[g>>2]|0;Qc(a,b,d,k,c[h+324>>2]|0,c[h+328>>2]|0)}else Qc(a,b,d,k,d,k);k=c[g+4>>2]|0;if(!k){Ia=e;return}g=k+4|0;d=c[g>>2]|0;c[g>>2]=d+-1;if(d|0){Ia=e;return}Pa[c[(c[k>>2]|0)+8>>2]&255](k);mi(k);Ia=e;return}
function Ne(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0.0,k=0,l=0.0,m=0.0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,x=0,y=0,z=0,A=0,C=0,D=0,E=0,F=0.0,G=0.0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0.0,Q=0.0,R=0.0,S=0.0,T=0,U=0,V=0,W=0,X=0,Y=0;b=Ia;Ia=Ia+16|0;if((Ia|0)>=(Ja|0))B(16);d=b;e=c[a+76>>2]|0;f=c[a+64>>2]|0;g=a+56|0;h=c[g>>2]|0;i=c[h+332>>2]|0;j=+(i+-1|0);k=c[h+336>>2]|0;l=+(k+-1|0);a:do if((k|0)>0){m=j*l;n=f+(e*80|0)+16|0;o=f+(e*80|0)+32|0;p=f+(e*80|0)+48|0;q=f+(e*80|0)+64|0;r=f+(e*80|0)+20|0;s=f+(e*80|0)+36|0;t=f+(e*80|0)+52|0;u=f+(e*80|0)+68|0;v=f+(e*80|0)+24|0;x=f+(e*80|0)+40|0;y=f+(e*80|0)+56|0;z=f+(e*80|0)+72|0;A=a+4|0;C=0;D=h;E=i;b:while(1){c:do if((E|0)>0){F=+(C|0);G=l-F;H=0;I=D;while(1){J=c[(c[I+424>>2]|0)+(C*12|0)>>2]|0;K=c[J+(H<<3)>>2]|0;L=c[J+(H<<3)+4>>2]|0;J=(L|0)==0;if(!J){M=L+4|0;c[M>>2]=(c[M>>2]|0)+1}M=gj(c[K+340>>2]|0,2808,2848,0)|0;N=c[K+344>>2]|0;if(!N)O=0;else{K=N+4|0;c[K>>2]=(c[K>>2]|0)+1;O=N}P=+(H|0);Q=j-P;R=G*Q/m;S=G*P/m;P=Q*F/m;Q=+(w(H,C)|0)/m;N=(~~(R*+((c[r>>2]|0)>>>0)+S*+((c[s>>2]|0)>>>0)+P*+((c[t>>2]|0)>>>0)+Q*+((c[u>>2]|0)>>>0))>>>0<<16)+(~~(R*+((c[n>>2]|0)>>>0)+S*+((c[o>>2]|0)>>>0)+P*+((c[p>>2]|0)>>>0)+Q*+((c[q>>2]|0)>>>0))>>>0<<24)+(~~(R*+((c[v>>2]|0)>>>0)+S*+((c[x>>2]|0)>>>0)+P*+((c[y>>2]|0)>>>0)+Q*+((c[z>>2]|0)>>>0))>>>0<<8)|255;K=c[A>>2]|0;T=(c[K+((c[M+4>>2]|0)*48|0)+32>>2]|0)+1|0;switch(c[K+(T*48|0)+44>>2]|0){case 7:case 5:case 4:{U=c[K+(T*48|0)+36>>2]|0;break}default:U=0}if((N|0)==(U|0))V=0;else{c[d>>2]=C;c[d+4>>2]=H;c[d+8>>2]=N;c[d+12>>2]=U;bi(14371,d)|0;V=1}if(O|0?(N=O+4|0,T=c[N>>2]|0,c[N>>2]=T+-1,(T|0)==0):0){Pa[c[(c[O>>2]|0)+8>>2]&255](O);mi(O)}if(!J?(J=L+4|0,T=c[J>>2]|0,c[J>>2]=T+-1,(T|0)==0):0){Pa[c[(c[L>>2]|0)+8>>2]&255](L);mi(L)}H=H+1|0;if(V|0){W=0;break b}L=c[g>>2]|0;T=c[L+332>>2]|0;if((H|0)>=(T|0)){X=T;Y=L;break c}else I=L}}else{X=E;Y=D}while(0);C=C+1|0;if((C|0)>=(c[Y+336>>2]|0))break a;else{D=Y;E=X}}Ia=b;return W|0}while(0);di(16348)|0;W=1;Ia=b;return W|0}function Oe(b,d,e,g){b=b|0;d=d|0;e=e|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,u=0,v=0.0,w=0.0,x=0.0,y=0,z=0,A=0,B=0,C=0.0,D=0,E=0.0,F=0,G=0.0,H=0,I=0,J=0,K=0,L=0,M=0,N=0.0,O=0.0,P=0.0,Q=0.0,R=0.0,S=0.0,T=0.0,U=0,V=0,W=0,X=0.0,Y=0,Z=0,_=0,$=0.0,aa=0,ba=0,ca=0,da=0,ea=0,fa=0.0,ga=0,ha=0;e=c[g>>2]|0;h=c[e+324>>2]|0;i=c[e+328>>2]|0;e=d+336|0;j=c[e>>2]|0;if((j|0)>0){k=d+332|0;l=d+424|0;m=d+440|0;n=d+444|0;o=d+448|0;p=d+452|0;q=d+24|0;r=d+28|0;s=d+16|0;u=d+20|0;v=+(i|0);w=+(i+1|0);d=0;x=1.0e6;y=0;z=0;A=j;j=c[k>>2]|0;while(1){if((j|0)>0){B=(d|0)==(h|0);C=+(d|0);D=d+1|0;E=+(D|0);F=0;G=x;H=y;I=z;while(1){J=c[(c[l>>2]|0)+(d*12|0)>>2]|0;K=c[J+(F<<3)>>2]|0;L=c[J+(F<<3)+4>>2]|0;J=(L|0)==0;if(!J){M=L+4|0;c[M>>2]=(c[M>>2]|0)+1}if(B&(F|0)==(i|0)){N=+f[m>>2];O=+f[n>>2];M=c[g>>2]|0;P=+f[q>>2];Q=+f[r>>2];R=(N*v+ +f[o>>2]*w)*P+ +f[s>>2]-(N*P+0.0)*+f[M+8>>2]+0.0-+f[M+16>>2];P=(O*C+ +f[p>>2]*E)*Q+ +f[u>>2]-(O*Q+0.0)*+f[M+12>>2]+0.0-+f[M+20>>2];S=R*R;T=P*P}else{M=c[g>>2]|0;U=K;P=+f[U+16>>2]-+f[M+16>>2];R=+f[U+20>>2]-+f[M+20>>2];S=P*P;T=R*R}R=+t(+(S+T));if(R<G?(a[K+64>>0]|0)!=0:0){M=L;if(!J){U=L+4|0;c[U>>2]=(c[U>>2]|0)+1}U=I;if((I|0)!=0?(V=U+4|0,W=c[V>>2]|0,c[V>>2]=W+-1,(W|0)==0):0){Pa[c[(c[I>>2]|0)+8>>2]&255](U);mi(U);X=R;Y=K;Z=M}else{X=R;Y=K;Z=M}}else{X=G;Y=H;Z=I}if(!J?(J=L+4|0,M=c[J>>2]|0,c[J>>2]=M+-1,(M|0)==0):0){Pa[c[(c[L>>2]|0)+8>>2]&255](L);mi(L)}F=F+1|0;_=c[k>>2]|0;if((F|0)>=(_|0))break;else{G=X;H=Y;I=Z}}$=X;aa=D;ba=Y;ca=Z;da=_;ea=c[e>>2]|0}else{$=x;aa=d+1|0;ba=y;ca=z;da=j;ea=A}if((aa|0)<(ea|0)){d=aa;x=$;y=ba;z=ca;A=ea;j=da}else break}da=ca;if(!ca){fa=$;ga=ba;ha=da}else{j=da+4|0;c[j>>2]=(c[j>>2]|0)+1;c[b>>2]=ba;c[b+4>>2]=da;c[j>>2]=(c[j>>2]|0)+1;f[b+8>>2]=$;ba=c[j>>2]|0;c[j>>2]=ba+-1;if(!ba){Pa[c[(c[ca>>2]|0)+8>>2]&255](da);mi(da)}ba=c[j>>2]|0;c[j>>2]=ba+-1;if(ba|0)return;Pa[c[(c[ca>>2]|0)+8>>2]&255](da);mi(da);return}}else{fa=1.0e6;ga=0;ha=0}c[b>>2]=ga;c[b+4>>2]=ha;f[b+8>>2]=fa;return}function Pe(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0;b=Ia;Ia=Ia+96|0;if((Ia|0)>=(Ja|0))B(96);d=b+80|0;e=b+72|0;f=b+48|0;g=b+24|0;h=b;i=a+56|0;j=a+4|0;oe(c[i>>2]|0,j);k=(((c[a+36>>2]|0)-(c[a+32>>2]|0)|0)/48|0)+-1|0;c[e>>2]=0;c[e+4>>2]=k;k=a+44|0;l=a+48|0;c[l>>2]=c[k>>2];m=a+52|0;a:do{n=Rc(e,18348,e)|0;c[d>>2]=n;o=c[k>>2]|0;p=c[l>>2]|0;b:do if((o|0)==(p|0))q=o;else{r=o;while(1){if((c[r>>2]|0)==(n|0)){q=r;break b}r=r+4|0;if((r|0)==(p|0))break a}}while(0)}while((q|0)!=(p|0));if((p|0)==(c[m>>2]|0))Jf(k,d);else{c[p>>2]=n;c[l>>2]=p+4}c:do{s=Rc(e,18348,e)|0;c[d>>2]=s;p=c[k>>2]|0;t=c[l>>2]|0;d:do if((p|0)==(t|0))u=p;else{n=p;while(1){if((c[n>>2]|0)==(s|0)){u=n;break d}n=n+4|0;if((n|0)==(t|0))break c}}while(0)}while((u|0)!=(t|0));if((t|0)==(c[m>>2]|0))Jf(k,d);else{c[t>>2]=s;c[l>>2]=t+4}e:do{v=Rc(e,18348,e)|0;c[d>>2]=v;t=c[k>>2]|0;w=c[l>>2]|0;f:do if((t|0)==(w|0))x=t;else{s=t;while(1){if((c[s>>2]|0)==(v|0)){x=s;break f}s=s+4|0;if((s|0)==(w|0))break e}}while(0)}while((x|0)!=(w|0));if((w|0)==(c[m>>2]|0))Jf(k,d);else{c[w>>2]=v;c[l>>2]=w+4}g:do{y=Rc(e,18348,e)|0;c[d>>2]=y;w=c[k>>2]|0;z=c[l>>2]|0;h:do if((w|0)==(z|0))A=w;else{v=w;while(1){if((c[v>>2]|0)==(y|0)){A=v;break h}v=v+4|0;if((v|0)==(z|0))break g}}while(0)}while((A|0)!=(z|0));if((z|0)==(c[m>>2]|0))Jf(k,d);else{c[z>>2]=y;c[l>>2]=z+4}i:do{C=Rc(e,18348,e)|0;c[d>>2]=C;z=c[k>>2]|0;D=c[l>>2]|0;j:do if((z|0)==(D|0))E=z;else{y=z;while(1){if((c[y>>2]|0)==(C|0)){E=y;break j}y=y+4|0;if((y|0)==(D|0))break i}}while(0)}while((E|0)!=(D|0));if((D|0)==(c[m>>2]|0))Jf(k,d);else{c[D>>2]=C;c[l>>2]=D+4}D=c[i>>2]|0;if((c[D+336>>2]|0)>0){l=f+16|0;C=a;m=d+4|0;E=g+16|0;e=g+4|0;z=g+8|0;y=g+12|0;A=h+16|0;w=h+4|0;v=h+8|0;x=h+12|0;t=0;s=D;while(1){k:do if((c[s+332>>2]|0)>0){D=0;u=s;while(1){me(d,u,j,t,D,c[(c[k>>2]|0)+(t<<2)>>2]|0);p=c[d>>2]|0;n=c[p+340>>2]|0;q=p;if((n|0)!=0?(o=gj(n,2808,3432,0)|0,(o|0)!=0):0){n=c[p+344>>2]|0;if(!n){F=o;G=0}else{r=n+4|0;c[r>>2]=(c[r>>2]|0)+1;F=o;G=n}}else{F=0;G=0}n=c[j>>2]|0;o=(c[n+((c[(c[F+332>>2]|0)+4>>2]|0)*48|0)+32>>2]|0)+1|0;switch(c[n+(o*48|0)+44>>2]|0){case 7:case 5:case 4:{H=n+(o*48|0)+36|0;I=25;break}case 8:{H=n+(o*48|0)+32|0;I=25;break}default:{}}if((I|0)==25){I=0;c[H>>2]=0}o=(c[n+((c[F+4>>2]|0)*48|0)+32>>2]|0)+1|0;switch(c[n+(o*48|0)+44>>2]|0){case 7:case 5:case 4:{J=n+(o*48|0)+36|0;I=29;break}case 8:{J=n+(o*48|0)+32|0;I=29;break}default:{}}if((I|0)==29){I=0;c[J>>2]=255}c[l>>2]=0;o=c[m>>2]|0;if(!o)K=0;else{n=o+4|0;c[n>>2]=(c[n>>2]|0)+1;K=c[m>>2]|0}c[g>>2]=5144;c[e>>2]=C;c[z>>2]=q;c[y>>2]=o;c[E>>2]=g;if(K|0){o=K+4|0;c[o>>2]=(c[o>>2]|0)+1}c[h>>2]=5188;c[w>>2]=C;c[v>>2]=q;c[x>>2]=K;c[A>>2]=h;ne(p,f,g,h);p=c[A>>2]|0;if((h|0)!=(p|0)){if(p|0)Pa[c[(c[p>>2]|0)+20>>2]&255](p)}else Pa[c[(c[p>>2]|0)+16>>2]&255](p);p=c[E>>2]|0;if((g|0)!=(p|0)){if(p|0)Pa[c[(c[p>>2]|0)+20>>2]&255](p)}else Pa[c[(c[p>>2]|0)+16>>2]&255](p);p=c[l>>2]|0;if((f|0)!=(p|0)){if(p|0)Pa[c[(c[p>>2]|0)+20>>2]&255](p)}else Pa[c[(c[p>>2]|0)+16>>2]&255](p);if(G|0?(p=G+4|0,q=c[p>>2]|0,c[p>>2]=q+-1,(q|0)==0):0){Pa[c[(c[G>>2]|0)+8>>2]&255](G);mi(G)}q=c[m>>2]|0;do if(q|0){p=q+4|0;o=c[p>>2]|0;c[p>>2]=o+-1;if(o|0)break;Pa[c[(c[q>>2]|0)+8>>2]&255](q);mi(q)}while(0);D=D+1|0;q=c[i>>2]|0;if((D|0)>=(c[q+332>>2]|0)){L=q;break k}else u=q}}else L=s;while(0);t=t+1|0;if((t|0)>=(c[L+336>>2]|0))break;else s=L}}if(!(If(a)|0)){M=c[i>>2]|0;N=c[M>>2]|0;O=N+8|0;P=c[O>>2]|0;Q=M+44|0;R=M+36|0;Ua[P&15](M,j,Q,R);Ia=b;return}L=d+4|0;do{s=c[i>>2]|0;t=c[s+336>>2]|0;c[d>>2]=0;c[L>>2]=t+-1;if((t|0)>0){t=0;m=s;while(1){if((c[m+332>>2]|0)>0){s=0;do{G=Rc(d,18348,d)|0;Qc(c[i>>2]|0,j,t,s,G,s);s=s+1|0;G=c[i>>2]|0}while((s|0)<(c[G+332>>2]|0));S=G}else S=m;t=t+1|0;if((t|0)>=(c[S+336>>2]|0))break;else m=S}}}while(If(a)|0);M=c[i>>2]|0;N=c[M>>2]|0;O=N+8|0;P=c[O>>2]|0;Q=M+44|0;R=M+36|0;Ua[P&15](M,j,Q,R);Ia=b;return}function Qe(a){a=a|0;oi(a);return}function Re(a){a=a|0;var b=0;b=ni(8)|0;c[b>>2]=4876;c[b+4>>2]=c[a+4>>2];return b|0}function Se(a,b){a=a|0;b=b|0;c[b>>2]=4876;c[b+4>>2]=c[a+4>>2];return}function Te(a){a=a|0;return}function Ue(a){a=a|0;oi(a);return}function Ve(a){a=a|0;var b=0;b=c[a+4>>2]|0;a=ni(344)|0;Ye(a,b+4|0);return a|0}function We(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==14629?a+4|0:0)|0}function Xe(a){a=a|0;return 3448}function Ye(b,d){b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0;e=Ia;Ia=Ia+96|0;if((Ia|0)>=(Ja|0))B(96);f=e+8|0;g=e;h=e+48|0;i=e+24|0;j=e+40|0;k=e+16|0;jb(b,d);c[b>>2]=4944;l=h+8|0;m=l+36|0;do{c[l>>2]=0;l=l+4|0}while((l|0)<(m|0));c[h+44>>2]=4;c[h>>2]=0;c[h+4>>2]=0;c[h+16>>2]=0;c[h+20>>2]=0;c[h+32>>2]=-1;c[h+36>>2]=255;n=d+4|0;o=c[n>>2]|0;p=c[d>>2]|0;c[p+((c[b+4>>2]|0)*48|0)+36>>2]=(o-p|0)/48|0;if((c[d+8>>2]|0)==(o|0))Gb(d,h);else{l=o;q=h;m=l+48|0;do{c[l>>2]=c[q>>2];l=l+4|0;q=q+4|0}while((l|0)<(m|0));c[n>>2]=(c[n>>2]|0)+48}c[b>>2]=4920;n=b+324|0;o=b+328|0;p=b+332|0;r=b+336|0;c[n>>2]=0;c[n+4>>2]=0;c[n+8>>2]=0;c[n+12>>2]=0;s=ni(328)|0;c[i>>2]=0;c[i+4>>2]=0;c[i+8>>2]=0;t=ni(32)|0;c[i>>2]=t;c[i+8>>2]=-2147483616;c[i+4>>2]=18;l=t;q=14564;m=l+18|0;do{a[l>>0]=a[q>>0]|0;l=l+1|0;q=q+1|0}while((l|0)<(m|0));a[t+18>>0]=0;kb(s,d,i,-1,16.0);c[h>>2]=s;t=ni(16)|0;c[t+4>>2]=0;c[t+8>>2]=0;c[t>>2]=4156;c[t+12>>2]=s;q=h+4|0;c[q>>2]=t;c[g>>2]=s;c[g+4>>2]=s;le(h,g);s=c[h>>2]|0;t=c[q>>2]|0;c[h>>2]=0;c[q>>2]=0;c[n>>2]=s;s=c[o>>2]|0;c[o>>2]=t;if(s|0?(t=s+4|0,l=c[t>>2]|0,c[t>>2]=l+-1,(l|0)==0):0){Pa[c[(c[s>>2]|0)+8>>2]&255](s);mi(s)}s=c[q>>2]|0;if(s|0?(q=s+4|0,l=c[q>>2]|0,c[q>>2]=l+-1,(l|0)==0):0){Pa[c[(c[s>>2]|0)+8>>2]&255](s);mi(s)}if((a[i+11>>0]|0)<0)oi(c[i>>2]|0);i=c[n>>2]|0;Ta[c[c[i>>2]>>2]&3](i,d,2);i=c[(c[n>>2]|0)+4>>2]|0;s=c[d>>2]|0;c[s+(i*48|0)>>2]=0;c[s+(i*48|0)+4>>2]=1053609165;i=c[(c[n>>2]|0)+4>>2]|0;s=c[d>>2]|0;c[s+(i*48|0)+16>>2]=1092616192;c[s+(i*48|0)+20>>2]=0;i=c[n>>2]|0;c[i+8>>2]=0;c[i+12>>2]=1056964608;i=ni(328)|0;c[h>>2]=0;c[h+4>>2]=0;c[h+8>>2]=0;s=h+11|0;a[s>>0]=5;a[h>>0]=a[14583]|0;a[h+1>>0]=a[14584]|0;a[h+2>>0]=a[14585]|0;a[h+3>>0]=a[14586]|0;a[h+4>>0]=a[14587]|0;a[h+5>>0]=0;kb(i,d,h,-256,16.0);c[g>>2]=i;l=ni(16)|0;c[l+4>>2]=0;c[l+8>>2]=0;c[l>>2]=4156;c[l+12>>2]=i;q=g+4|0;c[q>>2]=l;c[f>>2]=i;c[f+4>>2]=i;le(g,f);f=c[g>>2]|0;i=c[q>>2]|0;c[g>>2]=0;c[q>>2]=0;c[p>>2]=f;f=c[r>>2]|0;c[r>>2]=i;if(f|0?(i=f+4|0,g=c[i>>2]|0,c[i>>2]=g+-1,(g|0)==0):0){Pa[c[(c[f>>2]|0)+8>>2]&255](f);mi(f)}f=c[q>>2]|0;if(f|0?(q=f+4|0,g=c[q>>2]|0,c[q>>2]=g+-1,(g|0)==0):0){Pa[c[(c[f>>2]|0)+8>>2]&255](f);mi(f)}if((a[s>>0]|0)<0)oi(c[h>>2]|0);h=c[p>>2]|0;Ta[c[c[h>>2]>>2]&3](h,d,2);h=c[(c[p>>2]|0)+4>>2]|0;s=c[d>>2]|0;c[s+(h*48|0)>>2]=1065353216;c[s+(h*48|0)+4>>2]=1053609165;h=c[(c[p>>2]|0)+4>>2]|0;s=c[d>>2]|0;c[s+(h*48|0)+16>>2]=-1054867456;c[s+(h*48|0)+20>>2]=0;h=c[p>>2]|0;c[h+8>>2]=1065353216;c[h+12>>2]=1056964608;h=c[(c[b>>2]|0)+4>>2]|0;c[j>>2]=c[n>>2];n=j+4|0;s=c[o>>2]|0;c[n>>2]=s;if(s|0){o=s+4|0;c[o>>2]=(c[o>>2]|0)+1}Ta[h&3](b,d,j);j=c[n>>2]|0;if(j|0?(n=j+4|0,h=c[n>>2]|0,c[n>>2]=h+-1,(h|0)==0):0){Pa[c[(c[j>>2]|0)+8>>2]&255](j);mi(j)}j=c[(c[b>>2]|0)+4>>2]|0;c[k>>2]=c[p>>2];p=k+4|0;h=c[r>>2]|0;c[p>>2]=h;if(h|0){r=h+4|0;c[r>>2]=(c[r>>2]|0)+1}Ta[j&3](b,d,k);k=c[p>>2]|0;if(!k){Ia=e;return}p=k+4|0;d=c[p>>2]|0;c[p>>2]=d+-1;if(d|0){Ia=e;return}Pa[c[(c[k>>2]|0)+8>>2]&255](k);mi(k);Ia=e;return}function Ze(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0.0,o=0.0,p=0,q=0,r=0.0,s=0.0,t=0.0,u=0.0;g=Ia;Ia=Ia+32|0;if((Ia|0)>=(Ja|0))B(32);h=g+8|0;i=g;j=g+16|0;k=a+24|0;l=c[k+4>>2]|0;m=h;c[m>>2]=c[k>>2];c[m+4>>2]=l;l=a+16|0;m=c[l+4>>2]|0;k=i;c[k>>2]=c[l>>2];c[k+4>>2]=m;m=d;k=c[m+4>>2]|0;l=a+44|0;c[l>>2]=c[m>>2];c[l+4>>2]=k;k=e;l=c[k+4>>2]|0;m=a+36|0;c[m>>2]=c[k>>2];c[m+4>>2]=l;l=c[a+4>>2]|0;m=c[b>>2]|0;n=+f[m+(l*48|0)+8>>2]*+f[e>>2]+ +f[m+(l*48|0)+24>>2];k=e+4|0;o=+f[m+(l*48|0)+12>>2]*+f[k>>2]+ +f[m+(l*48|0)+28>>2];p=a+24|0;f[p>>2]=n;q=a+28|0;f[q>>2]=o;do if((c[a+56>>2]|0)==1){r=+f[a+52>>2];s=o*r;if(s<n){f[p>>2]=s;t=o;u=s;break}else{s=n/r;f[q>>2]=s;t=s;u=n;break}}else{t=o;u=n}while(0);n=+f[m+(l*48|0)+20>>2]+(+f[d+4>>2]+ +f[k>>2]*+f[m+(l*48|0)+4>>2]-t*+f[a+12>>2]);f[a+16>>2]=+f[m+(l*48|0)+16>>2]+(+f[d>>2]+ +f[e>>2]*+f[m+(l*48|0)>>2]-u*+f[a+8>>2]);f[a+20>>2]=n;Ua[c[(c[a>>2]|0)+12>>2]&15](a,b,i,h);yb(j,a,b);Ia=g;return}function _e(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0;e=c[b>>2]|0;b=(c[e+((c[a+4>>2]|0)*48|0)+32>>2]|0)+1|0;d=a+16|0;f=c[d+4>>2]|0;g=e+(b*48|0)|0;c[g>>2]=c[d>>2];c[g+4>>2]=f;f=a+24|0;a=c[f+4>>2]|0;g=e+(b*48|0)+16|0;c[g>>2]=c[f>>2];c[g+4>>2]=a;return}function $e(a){a=a|0;oi(a);return}function af(a){a=a|0;var b=0;b=ni(8)|0;c[b>>2]=4968;c[b+4>>2]=c[a+4>>2];return b|0}function bf(a,b){a=a|0;b=b|0;c[b>>2]=4968;c[b+4>>2]=c[a+4>>2];return}function cf(a){a=a|0;return}function df(a){a=a|0;oi(a);return}function ef(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;hf(a+4|0,b,c,d,e);return}function ff(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==14749?a+4|0:0)|0}function gf(a){a=a|0;return 3472}function hf(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0;f=Ia;Ia=Ia+16|0;if((Ia|0)>=(Ja|0))B(16);e=f;h=c[d>>2]|0;d=c[g>>2]|0;g=c[b>>2]|0;if(!h)i=0;else i=gj(h,2808,3432,0)|0;h=g+4|0;b=c[g+32>>2]|0;jf(c[i+324>>2]|0,h,b+(d*48|0)+16|0);g=c[i+332>>2]|0;i=b+(d*48|0)+32|0;Oi(e,c[i>>2]|0,c[i+4>>2]|0);jf(g,h,e);if((a[e+11>>0]|0)>=0){Ia=f;return}oi(c[e>>2]|0);Ia=f;return}function jf(b,d,e){b=b|0;d=d|0;e=e|0;var g=0,h=0,i=0,j=0,k=0,l=0;g=b+4|0;h=c[d>>2]|0;i=(c[h+((c[g>>2]|0)*48|0)+32>>2]|0)+1|0;if((c[h+(i*48|0)+44>>2]|0)==8){if(!(Xb(18324,e)|0)){j=c[4579]|0;k=(j-(c[4578]|0)|0)/12|0;l=j;if((c[4580]|0)==(l|0))Yb(18312,e);else{wi(l,e);c[4579]=(c[4579]|0)+12}c[(Wb(18324,e)|0)>>2]=k}c[h+(i*48|0)+36>>2]=c[(Wb(18324,e)|0)>>2];f[h+(i*48|0)+16>>2]=+U(((a[e+11>>0]|0)<0?c[e>>2]|0:e)|0,+(+f[h+(i*48|0)+20>>2]))}if((c[b+56>>2]|0)!=2)return;i=c[g>>2]|0;g=c[d>>2]|0;h=g+(((c[g+(i*48|0)+32>>2]|0)+1|0)*48|0)+16|0;e=c[h+4>>2]|0;k=g+(i*48|0)+24|0;c[k>>2]=c[h>>2];c[k+4>>2]=e;Ua[c[(c[b>>2]|0)+8>>2]&15](b,d,b+44|0,b+36|0);return}function kf(a){a=a|0;oi(a);return}function lf(a){a=a|0;a=ni(8)|0;c[a>>2]=5012;return a|0}function mf(a,b){a=a|0;b=b|0;c[b>>2]=5012;return}function nf(a){a=a|0;return}function of(a){a=a|0;oi(a);return}function pf(a){a=a|0;return}function qf(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==14865?a+4|0:0)|0}function rf(a){a=a|0;return 3496}function sf(a){a=a|0;oi(a);return}function tf(a){a=a|0;a=ni(8)|0;c[a>>2]=5056;return a|0}function uf(a,b){a=a|0;b=b|0;c[b>>2]=5056;return}function vf(a){a=a|0;return}function wf(a){a=a|0;oi(a);return}function xf(a){a=a|0;return}function yf(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==14969?a+4|0:0)|0}function zf(a){a=a|0;return 3520}function Af(a){a=a|0;oi(a);return}function Bf(a){a=a|0;var b=0;b=ni(8)|0;c[b>>2]=5100;c[b+4>>2]=c[a+4>>2];return b|0}function Cf(a,b){a=a|0;b=b|0;c[b>>2]=5100;c[b+4>>2]=c[a+4>>2];return}function Df(a){a=a|0;return}function Ef(a){a=a|0;oi(a);return}function Ff(a,b){a=a|0;b=b|0;Pe(c[a+4>>2]|0);return}function Gf(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==15083?a+4|0:0)|0}function Hf(a){a=a|0;return 3544}function If(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0;b=Ia;Ia=Ia+16|0;if((Ia|0)>=(Ja|0))B(16);d=b;e=a+56|0;f=c[e>>2]|0;a:do if((c[f+336>>2]|0)>0){g=a+32|0;h=0;i=-1;j=-1;k=f;b:while(1){if((c[k+332>>2]|0)>0){l=0;m=k;n=j;o=i;while(1){p=c[(c[m+424>>2]|0)+(h*12|0)>>2]|0;q=c[p+(l<<3)>>2]|0;r=c[p+(l<<3)+4>>2]|0;p=(r|0)==0;if(!p){s=r+4|0;c[s>>2]=(c[s>>2]|0)+1}s=(c[g>>2]|0)+((c[q+332>>2]|0)*48|0)+32|0;q=c[s>>2]|0;t=c[s+4>>2]|0;if((t|0)<(n|0)|(t|0)==(n|0)&q>>>0<o>>>0){s=d;c[s>>2]=o;c[s+4>>2]=n;s=d+8|0;c[s>>2]=q;c[s+4>>2]=t;bi(15373,d)|0;u=1;v=o;w=n}else{u=0;v=q;w=t}if(!p?(p=r+4|0,t=c[p>>2]|0,c[p>>2]=t+-1,(t|0)==0):0){Pa[c[(c[r>>2]|0)+8>>2]&255](r);mi(r)}l=l+1|0;if(u|0){x=0;break b}r=c[e>>2]|0;if((l|0)>=(c[r+332>>2]|0)){y=r;z=v;A=w;break}else{m=r;n=w;o=v}}}else{y=k;z=i;A=j}h=h+1|0;if((h|0)>=(c[y+336>>2]|0))break a;else{i=z;j=A;k=y}}Ia=b;return x|0}while(0);di(16348)|0;x=1;Ia=b;return x|0}function Jf(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0;d=a+4|0;e=c[a>>2]|0;f=(c[d>>2]|0)-e|0;g=f>>2;h=g+1|0;if(h>>>0>1073741823)Si(a);i=a+8|0;j=(c[i>>2]|0)-e|0;k=j>>1;l=j>>2>>>0<536870911?(k>>>0<h>>>0?h:k):1073741823;do if(l)if(l>>>0>1073741823){k=da(8)|0;ti(k,10959);c[k>>2]=6220;ha(k|0,3864,124)}else{k=ni(l<<2)|0;m=k;n=k;break}else{m=0;n=0}while(0);k=m+(g<<2)|0;c[k>>2]=c[b>>2];if((f|0)>0)Tj(n|0,e|0,f|0)|0;c[a>>2]=m;c[d>>2]=k+4;c[i>>2]=m+(l<<2);if(!e)return;oi(e);return}function Kf(a){a=a|0;var b=0,d=0;c[a>>2]=5144;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Pa[c[(c[b>>2]|0)+8>>2]&255](b);mi(b);return}function Lf(a){a=a|0;var b=0,d=0,e=0;c[a>>2]=5144;b=c[a+12>>2]|0;if(!b){oi(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){oi(a);return}Pa[c[(c[b>>2]|0)+8>>2]&255](b);mi(b);oi(a);return}function Mf(a){a=a|0;var b=0,d=0;b=ni(16)|0;c[b>>2]=5144;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return b|0;a=d+4|0;c[a>>2]=(c[a>>2]|0)+1;return b|0}function Nf(a,b){a=a|0;b=b|0;var d=0;c[b>>2]=5144;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return;b=d+4|0;c[b>>2]=(c[b>>2]|0)+1;return}function Of(a){a=a|0;var b=0,d=0;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Pa[c[(c[b>>2]|0)+8>>2]&255](b);mi(b);return}function Pf(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b){oi(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){oi(a);return}Pa[c[(c[b>>2]|0)+8>>2]&255](b);mi(b);oi(a);return}function Qf(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0;b=Ia;Ia=Ia+16|0;if((Ia|0)>=(Ja|0))B(16);d=b;e=c[a+4>>2]|0;f=c[e+56>>2]|0;c[d>>2]=c[a+8>>2];g=d+4|0;h=c[a+12>>2]|0;c[g>>2]=h;if(h|0){a=h+4|0;c[a>>2]=(c[a>>2]|0)+1}ze(f,e+4|0,d);d=c[g>>2]|0;if(!d){Ia=b;return}g=d+4|0;e=c[g>>2]|0;c[g>>2]=e+-1;if(e|0){Ia=b;return}Pa[c[(c[d>>2]|0)+8>>2]&255](d);mi(d);Ia=b;return}function Rf(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==15204?a+4|0:0)|0}function Sf(a){a=a|0;return 3568}function Tf(a){a=a|0;var b=0,d=0;c[a>>2]=5188;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Pa[c[(c[b>>2]|0)+8>>2]&255](b);mi(b);return}function Uf(a){a=a|0;var b=0,d=0,e=0;c[a>>2]=5188;b=c[a+12>>2]|0;if(!b){oi(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){oi(a);return}Pa[c[(c[b>>2]|0)+8>>2]&255](b);mi(b);oi(a);return}function Vf(a){a=a|0;var b=0,d=0;b=ni(16)|0;c[b>>2]=5188;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return b|0;a=d+4|0;c[a>>2]=(c[a>>2]|0)+1;return b|0}function Wf(a,b){a=a|0;b=b|0;var d=0;c[b>>2]=5188;c[b+4>>2]=c[a+4>>2];c[b+8>>2]=c[a+8>>2];d=c[a+12>>2]|0;c[b+12>>2]=d;if(!d)return;b=d+4|0;c[b>>2]=(c[b>>2]|0)+1;return}function Xf(a){a=a|0;var b=0,d=0;b=c[a+12>>2]|0;if(!b)return;a=b+4|0;d=c[a>>2]|0;c[a>>2]=d+-1;if(d|0)return;Pa[c[(c[b>>2]|0)+8>>2]&255](b);mi(b);return}function Yf(a){a=a|0;var b=0,d=0,e=0;b=c[a+12>>2]|0;if(!b){oi(a);return}d=b+4|0;e=c[d>>2]|0;c[d>>2]=e+-1;if(e|0){oi(a);return}Pa[c[(c[b>>2]|0)+8>>2]&255](b);mi(b);oi(a);return}function Zf(a){a=a|0;ag(a+4|0);return}function _f(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==15337?a+4|0:0)|0}function $f(a){a=a|0;return 3592}function ag(a){a=a|0;var b=0,d=0,e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0.0;b=Ia;Ia=Ia+16|0;if((Ia|0)>=(Ja|0))B(16);d=b;e=c[a>>2]|0;g=a+4|0;h=c[g>>2]|0;i=e+4|0;j=h+4|0;k=c[j>>2]|0;l=c[i>>2]|0;m=l+(k*48|0)|0;n=l+(k*48|0)+4|0;o=+f[l+(k*48|0)+20>>2]/+f[h+40>>2]+ +f[n>>2];f[m>>2]=+f[l+(k*48|0)+16>>2]/+f[h+36>>2]+ +f[m>>2];f[n>>2]=o;n=c[j>>2]|0;j=c[i>>2]|0;c[j+(n*48|0)+16>>2]=0;c[j+(n*48|0)+20>>2]=0;n=c[e+56>>2]|0;c[d>>2]=c[g>>2];g=d+4|0;j=c[a+8>>2]|0;c[g>>2]=j;if(j|0){a=j+4|0;c[a>>2]=(c[a>>2]|0)+1}bg(n,i,d);d=c[g>>2]|0;if(d|0?(g=d+4|0,i=c[g>>2]|0,c[g>>2]=i+-1,(i|0)==0):0){Pa[c[(c[d>>2]|0)+8>>2]&255](d);mi(d)}if(!(If(e)|0)){Ia=b;return}cg(e);Ia=b;return}function bg(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0;e=Ia;Ia=Ia+48|0;if((Ia|0)>=(Ja|0))B(48);g=e+8|0;h=e;i=e+24|0;j=e+16|0;c[j>>2]=c[d>>2];k=j+4|0;l=c[d+4>>2]|0;c[k>>2]=l;if(l|0){m=l+4|0;c[m>>2]=(c[m>>2]|0)+1}Oe(i,a,b,j);j=c[k>>2]|0;if(j|0?(k=j+4|0,m=c[k>>2]|0,c[k>>2]=m+-1,(m|0)==0):0){Pa[c[(c[j>>2]|0)+8>>2]&255](j);mi(j)}j=c[d>>2]|0;do if((!(+f[j+24>>2]*1.5*.5<=+f[i+8>>2])?(m=c[i>>2]|0,(m|0)!=0):0)?(k=c[m+324>>2]|0,l=c[j+324>>2]|0,(k|0)!=(l|0)):0){n=c[m+328>>2]|0;if(k>>>0<l>>>0){m=l+-1|0;if((m|0)<(k|0)){o=j;p=l}else{q=l;r=m;while(1){c[h>>2]=r;bi(15327,h)|0;Qc(a,b,r,0,q,0);m=r+-1|0;if((m|0)<(k|0))break;else{s=r;r=m;q=s}}q=c[d>>2]|0;o=q;p=c[q+324>>2]|0}Qc(a,b,p,c[o+328>>2]|0,k,n);break}else{q=l+1|0;if((q|0)>(k|0)){t=j;u=l}else{r=l;s=q;while(1){c[g>>2]=s;bi(15327,g)|0;Qc(a,b,s,0,r,0);q=s+1|0;if((q|0)>(k|0))break;else{m=s;s=q;r=m}}r=c[d>>2]|0;t=r;u=c[r+324>>2]|0}Qc(a,b,u,c[t+328>>2]|0,k,n);break}}else v=9;while(0);if((v|0)==9){v=c[j+324>>2]|0;t=c[j+328>>2]|0;Qc(a,b,v,t,v,t)}t=c[i+4>>2]|0;if(!t){Ia=e;return}i=t+4|0;v=c[i>>2]|0;c[i>>2]=v+-1;if(v|0){Ia=e;return}Pa[c[(c[t>>2]|0)+8>>2]&255](t);mi(t);Ia=e;return}function cg(b){b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0;d=b+56|0;e=c[d>>2]|0;if((c[e+336>>2]|0)<=0)return;f=b+4|0;b=0;g=e;while(1){a:do if((c[g+332>>2]|0)>0){e=b*111|0;h=0;i=g;while(1){j=c[(c[i+424>>2]|0)+(b*12|0)>>2]|0;k=c[j+(h<<3)>>2]|0;l=c[j+(h<<3)+4>>2]|0;j=(l|0)==0;if(!j){m=l+4|0;c[m>>2]=(c[m>>2]|0)+1}m=c[k+340>>2]|0;if((m|0)!=0?(n=gj(m,2808,3432,0)|0,(n|0)!=0):0){m=c[k+344>>2]|0;if(!m){o=n;p=0}else{q=m+4|0;c[q>>2]=(c[q>>2]|0)+1;o=n;p=m}}else{o=0;p=0}m=(((e|0)/(c[(c[d>>2]|0)+336>>2]|0)|0)<<16)+814780416|255;n=c[f>>2]|0;q=(c[n+((c[(c[o+332>>2]|0)+4>>2]|0)*48|0)+32>>2]|0)+1|0;switch(c[n+(q*48|0)+44>>2]|0){case 7:case 5:case 4:{r=n+(q*48|0)+36|0;s=16;break}case 8:{r=n+(q*48|0)+32|0;s=16;break}default:{}}if((s|0)==16){s=0;c[r>>2]=m}m=(c[n+((c[o+4>>2]|0)*48|0)+32>>2]|0)+1|0;switch(c[n+(m*48|0)+44>>2]|0){case 7:case 5:case 4:{t=n+(m*48|0)+36|0;s=20;break}case 8:{t=n+(m*48|0)+32|0;s=20;break}default:{}}if((s|0)==20){s=0;c[t>>2]=1057023}m=k+88|0;n=c[m>>2]|0;if((k+72|0)!=(n|0)){if(n|0)Pa[c[(c[n>>2]|0)+20>>2]&255](n)}else Pa[c[(c[n>>2]|0)+16>>2]&255](n);c[m>>2]=0;m=k+112|0;n=c[m>>2]|0;if((k+96|0)!=(n|0)){if(n|0)Pa[c[(c[n>>2]|0)+20>>2]&255](n)}else Pa[c[(c[n>>2]|0)+16>>2]&255](n);c[m>>2]=0;m=k+136|0;n=c[m>>2]|0;if((k+120|0)!=(n|0)){if(n|0)Pa[c[(c[n>>2]|0)+20>>2]&255](n)}else Pa[c[(c[n>>2]|0)+16>>2]&255](n);c[m>>2]=0;a[k+64>>0]=0;if(p|0?(k=p+4|0,m=c[k>>2]|0,c[k>>2]=m+-1,(m|0)==0):0){Pa[c[(c[p>>2]|0)+8>>2]&255](p);mi(p)}if(!j?(j=l+4|0,m=c[j>>2]|0,c[j>>2]=m+-1,(m|0)==0):0){Pa[c[(c[l>>2]|0)+8>>2]&255](l);mi(l)}h=h+1|0;l=c[d>>2]|0;if((h|0)>=(c[l+332>>2]|0)){u=l;break a}else i=l}}else u=g;while(0);b=b+1|0;if((b|0)>=(c[u+336>>2]|0))break;else g=u}return}function dg(a){a=a|0;return}function eg(a){a=a|0;oi(a);return}function fg(a){a=a|0;var b=0;b=ni(8)|0;c[b>>2]=5252;c[b+4>>2]=c[a+4>>2];return b|0}function gg(a,b){a=a|0;b=b|0;c[b>>2]=5252;c[b+4>>2]=c[a+4>>2];return}function hg(a){a=a|0;return}function ig(a){a=a|0;oi(a);return}function jg(a){a=a|0;return mg(a+4|0)|0}function kg(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==15526?a+4|0:0)|0}function lg(a){a=a|0;return 3632}function mg(b){b=b|0;var d=0,e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0;d=Ia;Ia=Ia+80|0;if((Ia|0)>=(Ja|0))B(80);e=d;g=d+32|0;h=d+8|0;i=d+24|0;j=c[b>>2]|0;b=ni(328)|0;k=j+4|0;jb(b,k);c[b>>2]=4080;l=g+8|0;m=l+36|0;do{c[l>>2]=0;l=l+4|0}while((l|0)<(m|0));c[g+44>>2]=6;c[g>>2]=0;c[g+4>>2]=0;c[g+16>>2]=0;c[g+20>>2]=0;f[g+24>>2]=2.0;c[g+28>>2]=0;c[g+36>>2]=-1;n=j+8|0;o=c[n>>2]|0;p=c[k>>2]|0;c[p+((c[b+4>>2]|0)*48|0)+36>>2]=(o-p|0)/48|0;if((c[j+12>>2]|0)==(o|0))Gb(k,g);else{l=o;o=g;m=l+48|0;do{c[l>>2]=c[o>>2];l=l+4|0;o=o+4|0}while((l|0)<(m|0));c[n>>2]=(c[n>>2]|0)+48}Ta[c[c[b>>2]>>2]&3](b,k,3);n=ni(328)|0;c[h>>2]=0;c[h+4>>2]=0;c[h+8>>2]=0;o=h+11|0;a[o>>0]=4;c[h>>2]=1414743380;a[h+4>>0]=0;kb(n,k,h,-1,18.0);c[g>>2]=n;l=ni(16)|0;c[l+4>>2]=0;c[l+8>>2]=0;c[l>>2]=4156;c[l+12>>2]=n;m=g+4|0;c[m>>2]=l;c[e>>2]=n;c[e+4>>2]=n;zb(g,e);if((a[o>>0]|0)<0)oi(c[h>>2]|0);h=c[g>>2]|0;Ta[c[c[h>>2]>>2]&3](h,k,2);h=c[(c[g>>2]|0)+4>>2]|0;o=c[k>>2]|0;c[o+(h*48|0)>>2]=0;c[o+(h*48|0)+4>>2]=1056964608;h=c[g>>2]|0;c[h+8>>2]=0;c[h+12>>2]=1056964608;g=c[h+4>>2]|0;o=c[k>>2]|0;c[o+(g*48|0)+16>>2]=1082130432;c[o+(g*48|0)+20>>2]=-1065353216;g=c[(c[b>>2]|0)+4>>2]|0;c[i>>2]=h;h=i+4|0;o=c[m>>2]|0;c[h>>2]=o;if(o|0){e=o+4|0;c[e>>2]=(c[e>>2]|0)+1}Ta[g&3](b,k,i);i=c[h>>2]|0;if(i|0?(h=i+4|0,k=c[h>>2]|0,c[h>>2]=k+-1,(k|0)==0):0){Pa[c[(c[i>>2]|0)+8>>2]&255](i);mi(i)}i=c[m>>2]|0;if(!i){Ia=d;return b|0}m=i+4|0;k=c[m>>2]|0;c[m>>2]=k+-1;if(k|0){Ia=d;return b|0}Pa[c[(c[i>>2]|0)+8>>2]&255](i);mi(i);Ia=d;return b|0}function ng(a){a=a|0;oi(a);return}function og(a){a=a|0;var b=0;b=ni(8)|0;c[b>>2]=5296;c[b+4>>2]=c[a+4>>2];return b|0}function pg(a,b){a=a|0;b=b|0;c[b>>2]=5296;c[b+4>>2]=c[a+4>>2];return}function qg(a){a=a|0;return}function rg(a){a=a|0;oi(a);return}function sg(a,b,d,e,f){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;vg(a+4|0,c[b>>2]|0,c[d>>2]|0,c[e>>2]|0,c[f>>2]|0);return}function tg(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==15646?a+4|0:0)|0}function ug(a){a=a|0;return 3656}function vg(a,b,d,e,f){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0;e=c[a>>2]|0;a=c[(gj(b,2808,2880,0)|0)+312>>2]|0;b=c[a>>2]|0;if((b|0)!=0?(d=gj(b,2808,2912,0)|0,(d|0)!=0):0){b=c[a+4>>2]|0;if(!b){g=d;h=0}else{a=b+4|0;c[a>>2]=(c[a>>2]|0)+1;g=d;h=b}}else{g=0;h=0}jf(g,e+4|0,(c[e+40>>2]|0)+(f*12|0)|0);if(!h)return;f=h+4|0;e=c[f>>2]|0;c[f>>2]=e+-1;if(e|0)return;Pa[c[(c[h>>2]|0)+8>>2]&255](h);mi(h);return}function wg(b,d){b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0;e=b+4|0;f=c[b>>2]|0;g=((c[e>>2]|0)-f|0)/12|0;h=g+1|0;if(h>>>0>357913941)Si(b);i=b+8|0;j=((c[i>>2]|0)-f|0)/12|0;f=j<<1;k=j>>>0<178956970?(f>>>0<h>>>0?h:f):357913941;do if(k)if(k>>>0>357913941){f=da(8)|0;ti(f,15684);c[f>>2]=6220;ha(f|0,3864,124)}else{l=ni(k*12|0)|0;break}else l=0;while(0);f=l+(g*12|0)|0;g=f;h=l+(k*12|0)|0;wi(f,d);d=f+12|0;k=c[b>>2]|0;l=c[e>>2]|0;if((l|0)==(k|0)){m=g;n=k;o=k}else{j=l;l=g;g=f;while(1){f=j+-12|0;wi(g+-12|0,f);p=l+-12|0;if((f|0)==(k|0))break;else{j=f;l=p;g=p}}m=p;n=c[b>>2]|0;o=c[e>>2]|0}c[b>>2]=m;c[e>>2]=d;c[i>>2]=h;h=n;if((o|0)!=(h|0)){i=o;do{i=i+-12|0;if((a[i+11>>0]|0)<0)oi(c[i>>2]|0)}while((i|0)!=(h|0))}if(!n)return;oi(n);return}function xg(a,b){a=a|0;b=b|0;return}function yg(a){a=a|0;li(a);oi(a);return}function zg(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;Cg(b);oi(b);return}function Ag(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==15846?a+12|0:0)|0}function Bg(a){a=a|0;oi(a);return}function Cg(a){a=a|0;var b=0,d=0,e=0;c[a>>2]=3936;b=c[a+64>>2]|0;if(b|0){c[a+68>>2]=b;oi(b)}b=c[a+60>>2]|0;if(b|0?(d=b+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){Pa[c[(c[b>>2]|0)+8>>2]&255](b);mi(b)}b=c[a+52>>2]|0;if(b|0?(e=b+4|0,d=c[e>>2]|0,c[e>>2]=d+-1,(d|0)==0):0){Pa[c[(c[b>>2]|0)+8>>2]&255](b);mi(b)}b=c[a+44>>2]|0;if(b|0?(d=b+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){Pa[c[(c[b>>2]|0)+8>>2]&255](b);mi(b)}b=c[a+36>>2]|0;if(b|0?(e=b+4|0,d=c[e>>2]|0,c[e>>2]=d+-1,(d|0)==0):0){Pa[c[(c[b>>2]|0)+8>>2]&255](b);mi(b)}c[a>>2]=3956;b=c[a+20>>2]|0;if(b|0?(d=b+4|0,e=c[d>>2]|0,c[d>>2]=e+-1,(e|0)==0):0){Pa[c[(c[b>>2]|0)+8>>2]&255](b);mi(b)}b=c[a+4>>2]|0;if(!b)return;c[a+8>>2]=b;oi(b);return}function Dg(a,b){a=a|0;b=b|0;return}function Eg(a){a=a|0;li(a);oi(a);return}function Fg(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;Ig(b);oi(b);return}function Gg(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==15973?a+12|0:0)|0}function Hg(a){a=a|0;oi(a);return}function Ig(b){b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0;c[b>>2]=4856;d=c[b+60>>2]|0;if(d|0?(e=d+4|0,f=c[e>>2]|0,c[e>>2]=f+-1,(f|0)==0):0){Pa[c[(c[d>>2]|0)+8>>2]&255](d);mi(d)}d=c[b+44>>2]|0;if(d|0){c[b+48>>2]=d;oi(d)}d=b+32|0;f=c[d>>2]|0;if(f|0){e=b+36|0;g=c[e>>2]|0;if((g|0)==(f|0))h=f;else{i=g;do{g=i+-32|0;if((a[g+11>>0]|0)<0)oi(c[g>>2]|0);g=i+-44|0;i=i+-48|0;if((a[g+11>>0]|0)<0)oi(c[g>>2]|0)}while((i|0)!=(f|0));h=c[d>>2]|0}c[e>>2]=f;oi(h)}c[b>>2]=3956;h=c[b+20>>2]|0;if(h|0?(f=h+4|0,e=c[f>>2]|0,c[f>>2]=e+-1,(e|0)==0):0){Pa[c[(c[h>>2]|0)+8>>2]&255](h);mi(h)}h=c[b+4>>2]|0;if(!h)return;c[b+8>>2]=h;oi(h);return}function Jg(a,b){a=a|0;b=b|0;return}function Kg(a){a=a|0;li(a);oi(a);return}function Lg(a){a=a|0;var b=0;b=c[a+12>>2]|0;if(!b)return;Og(b);oi(b);return}function Mg(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==16102?a+12|0:0)|0}function Ng(a){a=a|0;oi(a);return}function Og(b){b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0;c[b>>2]=5232;d=b+40|0;e=c[b+60>>2]|0;if(e|0){f=e;do{e=f;f=c[f>>2]|0;g=e+8|0;if((a[g+11>>0]|0)<0)oi(c[g>>2]|0);oi(e)}while((f|0)!=0)}f=b+52|0;e=c[f>>2]|0;c[f>>2]=0;if(e|0)oi(e);e=c[d>>2]|0;if(e|0){f=b+44|0;g=c[f>>2]|0;if((g|0)==(e|0))h=e;else{i=g;do{i=i+-12|0;if((a[i+11>>0]|0)<0)oi(c[i>>2]|0)}while((i|0)!=(e|0));h=c[d>>2]|0}c[f>>2]=e;oi(h)}h=c[b+36>>2]|0;if(h|0?(e=h+4|0,f=c[e>>2]|0,c[e>>2]=f+-1,(f|0)==0):0){Pa[c[(c[h>>2]|0)+8>>2]&255](h);mi(h)}c[b>>2]=3956;h=c[b+20>>2]|0;if(h|0?(f=h+4|0,e=c[f>>2]|0,c[f>>2]=e+-1,(e|0)==0):0){Pa[c[(c[h>>2]|0)+8>>2]&255](h);mi(h)}h=c[b+4>>2]|0;if(!h)return;c[b+8>>2]=h;oi(h);return}function Pg(a){a=a|0;oi(a);return}function Qg(a){a=a|0;var b=0,d=0;b=ni(24)|0;d=a+4|0;c[b>>2]=5424;a=b+4|0;c[a>>2]=c[d>>2];c[a+4>>2]=c[d+4>>2];c[a+8>>2]=c[d+8>>2];c[a+12>>2]=c[d+12>>2];c[a+16>>2]=c[d+16>>2];return b|0}function Rg(a,b){a=a|0;b=b|0;var d=0;d=a+4|0;c[b>>2]=5424;a=b+4|0;c[a>>2]=c[d>>2];c[a+4>>2]=c[d+4>>2];c[a+8>>2]=c[d+8>>2];c[a+12>>2]=c[d+12>>2];c[a+16>>2]=c[d+16>>2];return}function Sg(a){a=a|0;return}function Tg(a){a=a|0;oi(a);return}function Ug(a){a=a|0;var b=0,d=0,e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0;b=Ia;Ia=Ia+16|0;if((Ia|0)>=(Ja|0))B(16);d=b;e=S()|0;g=a+4|0;if((e|0)==(c[c[g>>2]>>2]|0)){h=a+8|0;i=c[h>>2]|0;Xg(i);Ia=b;return}c[d>>2]=e;bi(16205,d)|0;c[c[g>>2]>>2]=e;switch(e|0){case 0:{e=c[a+8>>2]|0;g=c[a+12>>2]|0;j=c[g>>2]|0;k=c[g+4>>2]|0;g=(k|0)==0;if(!g){l=k+4|0;c[l>>2]=(c[l>>2]|0)+1;c[l>>2]=(c[l>>2]|0)+1}l=e+32|0;c[l>>2]=j;j=e+36|0;m=c[j>>2]|0;c[j>>2]=k;if(m|0?(j=m+4|0,n=c[j>>2]|0,c[j>>2]=n+-1,(n|0)==0):0){Pa[c[(c[m>>2]|0)+8>>2]&255](m);mi(m)}m=c[l>>2]|0;l=e+24|0;e=l;n=c[e+4>>2]|0;j=m+24|0;c[j>>2]=c[e>>2];c[j+4>>2]=n;n=c[m+16>>2]|0;if(n|0){j=c[(c[n>>2]|0)+8>>2]|0;f[d>>2]=0.0;f[d+4>>2]=0.0;Ua[j&15](n,m+4|0,d,l)}if(g){h=a+8|0;i=c[h>>2]|0;Xg(i);Ia=b;return}g=k+4|0;l=c[g>>2]|0;c[g>>2]=l+-1;if(l|0){h=a+8|0;i=c[h>>2]|0;Xg(i);Ia=b;return}Pa[c[(c[k>>2]|0)+8>>2]&255](k);mi(k);h=a+8|0;i=c[h>>2]|0;Xg(i);Ia=b;return}case 1:{k=c[a+8>>2]|0;l=c[a+16>>2]|0;g=c[l>>2]|0;m=c[l+4>>2]|0;l=(m|0)==0;if(!l){n=m+4|0;c[n>>2]=(c[n>>2]|0)+1;c[n>>2]=(c[n>>2]|0)+1}n=k+32|0;c[n>>2]=g;g=k+36|0;j=c[g>>2]|0;c[g>>2]=m;if(j|0?(g=j+4|0,e=c[g>>2]|0,c[g>>2]=e+-1,(e|0)==0):0){Pa[c[(c[j>>2]|0)+8>>2]&255](j);mi(j)}j=c[n>>2]|0;n=k+24|0;k=n;e=c[k+4>>2]|0;g=j+24|0;c[g>>2]=c[k>>2];c[g+4>>2]=e;e=c[j+16>>2]|0;if(e|0){g=c[(c[e>>2]|0)+8>>2]|0;f[d>>2]=0.0;f[d+4>>2]=0.0;Ua[g&15](e,j+4|0,d,n)}if(l){h=a+8|0;i=c[h>>2]|0;Xg(i);Ia=b;return}l=m+4|0;n=c[l>>2]|0;c[l>>2]=n+-1;if(n|0){h=a+8|0;i=c[h>>2]|0;Xg(i);Ia=b;return}Pa[c[(c[m>>2]|0)+8>>2]&255](m);mi(m);h=a+8|0;i=c[h>>2]|0;Xg(i);Ia=b;return}case 2:{m=c[a+8>>2]|0;n=c[a+20>>2]|0;l=c[n>>2]|0;j=c[n+4>>2]|0;n=(j|0)==0;if(!n){e=j+4|0;c[e>>2]=(c[e>>2]|0)+1;c[e>>2]=(c[e>>2]|0)+1}e=m+32|0;c[e>>2]=l;l=m+36|0;g=c[l>>2]|0;c[l>>2]=j;if(g|0?(l=g+4|0,k=c[l>>2]|0,c[l>>2]=k+-1,(k|0)==0):0){Pa[c[(c[g>>2]|0)+8>>2]&255](g);mi(g)}g=c[e>>2]|0;e=m+24|0;m=e;k=c[m+4>>2]|0;l=g+24|0;c[l>>2]=c[m>>2];c[l+4>>2]=k;k=c[g+16>>2]|0;if(k|0){l=c[(c[k>>2]|0)+8>>2]|0;f[d>>2]=0.0;f[d+4>>2]=0.0;Ua[l&15](k,g+4|0,d,e)}if(n){h=a+8|0;i=c[h>>2]|0;Xg(i);Ia=b;return}n=j+4|0;e=c[n>>2]|0;c[n>>2]=e+-1;if(e|0){h=a+8|0;i=c[h>>2]|0;Xg(i);Ia=b;return}Pa[c[(c[j>>2]|0)+8>>2]&255](j);mi(j);h=a+8|0;i=c[h>>2]|0;Xg(i);Ia=b;return}default:{h=a+8|0;i=c[h>>2]|0;Xg(i);Ia=b;return}}}function Vg(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==16313?a+4|0:0)|0}function Wg(a){a=a|0;return 3728}function Xg(a){a=a|0;var b=0,d=0,e=0,h=0.0,i=0.0,j=0.0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0;b=Ia;Ia=Ia+16|0;if((Ia|0)>=(Ja|0))B(16);d=b;e=a+12|0;c[e>>2]=(c[e>>2]|0)+1;h=+wa();O();i=+Ca();j=+Ba();k=a+24|0;l=a+28|0;if(i==+f[k>>2]?j==+f[l>>2]:0)m=a+32|0;else{g[d>>3]=i;g[d+8>>3]=j;bi(16219,d)|0;f[k>>2]=i;f[l>>2]=j;l=a+32|0;n=c[l>>2]|0;o=k;p=c[o+4>>2]|0;q=n+24|0;c[q>>2]=c[o>>2];c[q+4>>2]=p;p=c[n+16>>2]|0;if(!p)m=l;else{q=c[(c[p>>2]|0)+8>>2]|0;f[d>>2]=0.0;f[d+4>>2]=0.0;Ua[q&15](p,n+4|0,d,k);m=l}}Yg(a);l=c[m>>2]|0;m=a+16|0;j=h-+g[m>>3];Qa[c[c[l>>2]>>2]&1](l,j,a);k=c[l+16>>2]|0;if(!k){r=c[e>>2]|0;Zg(a,h,r,0);g[m>>3]=h;Ia=b;return}bh(k,l+4|0,j);r=c[e>>2]|0;Zg(a,h,r,0);g[m>>3]=h;Ia=b;return}function Yg(a){a=a|0;var b=0,e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0.0,C=0;b=Ia;Ia=Ia+96|0;if((Ia|0)>=(Ja|0))B(96);e=b+64|0;g=b+48|0;h=b;i=b+80|0;j=b+72|0;if(!(aa(h|0)|0)){Ia=b;return}k=h+16|0;l=a+32|0;m=h+20|0;n=h+24|0;o=i+4|0;p=h+28|0;q=h+32|0;r=j+4|0;s=h+17|0;t=h+20|0;u=i+4|0;v=i+4|0;w=h+8|0;a:while(1){switch(c[h>>2]|0){case 256:{x=4;break a;break}case 769:{y=c[k>>2]|0;z=(c[a>>2]|0)+(y>>>5<<2)|0;c[z>>2]=c[z>>2]&~(1<<(y&31));z=c[l>>2]|0;Ra[c[(c[z>>2]|0)+4>>2]&31](z,y);break}case 768:{y=c[k>>2]|0;z=(c[a>>2]|0)+(y>>>5<<2)|0;c[z>>2]=c[z>>2]|1<<(y&31);z=c[l>>2]|0;Ra[c[(c[z>>2]|0)+8>>2]&31](z,y);break}case 1024:{y=c[l>>2]|0;A=+(c[n>>2]|0);f[i>>2]=+(c[m>>2]|0);f[o>>2]=A;A=+(c[q>>2]|0);f[j>>2]=+(c[p>>2]|0);f[r>>2]=A;z=c[y+16>>2]|0;if(z|0)_g(z,y+4|0,i,j)|0;break}case 1025:{y=d[s>>0]|0;z=c[t>>2]|0;C=c[n>>2]|0;c[g>>2]=d[k>>0];c[g+4>>2]=y;c[g+8>>2]=z;c[g+12>>2]=C;bi(16247,g)|0;C=c[l>>2]|0;A=+(c[n>>2]|0);f[i>>2]=+(c[t>>2]|0);f[u>>2]=A;z=c[C+16>>2]|0;if(z|0)$g(z,C+4|0,i)|0;break}case 1026:{C=c[l>>2]|0;A=+(c[n>>2]|0);f[i>>2]=+(c[t>>2]|0);f[v>>2]=A;z=c[C+16>>2]|0;if(z|0)ah(z,C+4|0,i)|0;break}case 512:{C=d[w>>0]|0;c[e>>2]=512;c[e+4>>2]=C;bi(16274,e)|0;break}default:{}}if(!(aa(h|0)|0)){x=18;break}}if((x|0)==4)oj();else if((x|0)==18){Ia=b;return}}function Zg(b,d,e,g){b=b|0;d=+d;e=e|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,s=0.0,t=0.0,u=0,w=0,x=0,y=0,z=0;g=Ia;Ia=Ia+16|0;if((Ia|0)>=(Ja|0))B(16);e=g;h=c[b+32>>2]|0;b=h+4|0;c[e>>2]=0;i=e+4|0;c[i>>2]=0;j=e+8|0;c[j>>2]=0;k=h+8|0;h=(c[k>>2]|0)-(c[b>>2]|0)|0;l=(h|0)/48|0;if(h){if(l>>>0>89478485)Si(e);m=ni(h)|0;c[i>>2]=m;c[e>>2]=m;c[j>>2]=m+(l*48|0);l=c[b>>2]|0;b=(c[k>>2]|0)-l|0;if((b|0)>0){Tj(m|0,l|0,b|0)|0;l=m+(((b>>>0)/48|0)*48|0)|0;c[i>>2]=l;if((l|0)==(m|0)){n=m;o=i}else{l=0;b=m;k=0;do{j=b+(k*48|0)|0;switch(c[b+(k*48|0)+44>>2]|0){case 1:{if(!(c[b+(k*48|0)+40>>2]|0)){p=c[b+(k*48|0)+36>>2]|0;q=0}else{p=k;q=l}break}case 2:{d=+f[b+(k*48|0)+16>>2];s=+f[b+(k*48|0)+20>>2];P(+(+f[j>>2]+d),+(+f[b+(k*48|0)+4>>2]+s),+d,+s,c[b+(k*48|0)+32>>2]|0);p=k;q=l;break}case 3:{s=+f[b+(k*48|0)+16>>2];d=+f[b+(k*48|0)+20>>2];X(+(+f[j>>2]+s),+(+f[b+(k*48|0)+4>>2]+d),+s,+d,+(+f[b+(k*48|0)+24>>2]),c[b+(k*48|0)+32>>2]|0);p=k;q=l;break}case 4:{d=+r(+(+f[j>>2]))+0.0;s=+r(+(+f[b+(k*48|0)+4>>2]))+0.0;t=+v(+(+f[b+(k*48|0)+16>>2]))+0.0;V(+d,+s,+t,+(+v(+(+f[b+(k*48|0)+20>>2]))+0.0),+(+f[b+(k*48|0)+24>>2]),c[b+(k*48|0)+32>>2]|0,c[b+(k*48|0)+36>>2]|0);p=k;q=l;break}case 5:{t=+r(+(+f[j>>2]))+0.0;s=+r(+(+f[b+(k*48|0)+4>>2]))+0.0;d=+v(+(+f[b+(k*48|0)+16>>2]))+0.0;Q(+t,+s,+d,+(+v(+(+f[b+(k*48|0)+20>>2]))+0.0),c[b+(k*48|0)+36>>2]|0);p=k;q=l;break}case 6:{d=+r(+(+f[j>>2]))+0.0;s=+r(+(+f[b+(k*48|0)+4>>2]))+0.0;t=+v(+(+f[b+(k*48|0)+16>>2]))+0.0;Y(+d,+s,+t,+(+v(+(+f[b+(k*48|0)+20>>2]))+0.0),+(+f[b+(k*48|0)+24>>2]),c[b+(k*48|0)+36>>2]|0);p=k;q=l;break}case 7:{W(+(+f[j>>2]),+(+f[b+(k*48|0)+4>>2]),+(+f[b+(k*48|0)+16>>2]),+(+f[b+(k*48|0)+20>>2]),+(+f[b+(k*48|0)+24>>2]),+(+f[b+(k*48|0)+28>>2]),c[b+(k*48|0)+32>>2]|0,c[b+(k*48|0)+36>>2]|0);p=k;q=l;break}case 8:{h=(c[4578]|0)+((c[b+(k*48|0)+36>>2]|0)*12|0)|0;if((a[h+11>>0]|0)<0)u=c[h>>2]|0;else u=h;t=+f[b+(k*48|0)+24>>2];R(u|0,+(+f[j>>2]),+(+f[b+(k*48|0)+4>>2]+t),+t,c[b+(k*48|0)+32>>2]|0);p=k;q=l;break}default:{p=k;q=l}}k=Lj(p|0,q|0,1,0)|0;l=A()|0;b=c[e>>2]|0}while((l|0)<0|((l|0)==0?k>>>0<(((c[i>>2]|0)-b|0)/48|0)>>>0:0));w=i;x=b;y=9}}else{z=m;y=5}}else{z=0;y=5}if((y|0)==5){w=i;x=z;y=9}if((y|0)==9)if(!x){Ia=g;return}else{n=x;o=w}c[o>>2]=n;oi(n);Ia=g;return}function _g(b,d,e,g){b=b|0;d=d|0;e=e|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0.0,o=0,p=0,q=0,r=0;h=Ia;Ia=Ia+16|0;if((Ia|0)>=(Ja|0))B(16);i=h;j=b+4|0;k=c[j>>2]|0;l=c[d>>2]|0;if(!(c[l+(k*48|0)+40>>2]|0)){m=0;Ia=h;return m|0}if(a[b+65>>0]|0){n=+f[l+(k*48|0)+20>>2]+ +f[g+4>>2];f[i>>2]=+f[l+(k*48|0)+16>>2]+ +f[g>>2];f[i+4>>2]=n;o=c[b+88>>2]|0;if(!o){p=l;q=k}else{Ra[c[(c[o>>2]|0)+24>>2]&31](o,i);p=c[d>>2]|0;q=c[j>>2]|0}j=i;i=c[j+4>>2]|0;o=p+(q*48|0)+16|0;c[o>>2]=c[j>>2];c[o+4>>2]=i;Ua[c[(c[b>>2]|0)+8>>2]&15](b,d,b+44|0,b+36|0);m=1;Ia=h;return m|0}if(a[b+225>>0]|0?(i=c[b+272>>2]|0,i|0):0){Ra[c[(c[i>>2]|0)+24>>2]&31](i,e);m=1;Ia=h;return m|0}i=b+312|0;o=c[i>>2]|0;j=(c[b+316>>2]|0)-o|0;if((j|0)<=0){m=0;Ia=h;return m|0}b=(j>>>3)+-1|0;j=o;while(1){o=c[j+(b<<3)>>2]|0;q=c[j+(b<<3)+4>>2]|0;p=(q|0)==0;if(!p){k=q+4|0;c[k>>2]=(c[k>>2]|0)+1}k=_g(o,d,e,g)|0;if(!p?(p=q+4|0,o=c[p>>2]|0,c[p>>2]=o+-1,(o|0)==0):0){Pa[c[(c[q>>2]|0)+8>>2]&255](q);mi(q)}if(k){m=1;r=19;break}k=b+-1|0;if((k|0)<=-1){m=0;r=19;break}b=k;j=c[i>>2]|0}if((r|0)==19){Ia=h;return m|0}return 0}function $g(b,d,e){b=b|0;d=d|0;e=e|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0.0,t=0.0,u=0.0;g=Ia;Ia=Ia+16|0;if((Ia|0)>=(Ja|0))B(16);h=g;if(!(c[(c[d>>2]|0)+((c[b+4>>2]|0)*48|0)+40>>2]|0)){i=0;Ia=g;return i|0}j=b+312|0;k=c[j>>2]|0;l=(c[b+316>>2]|0)-k|0;a:do if((l|0)>0){m=(l>>>3)+-1|0;n=k;while(1){o=c[n+(m<<3)>>2]|0;p=c[n+(m<<3)+4>>2]|0;q=(p|0)==0;if(!q){r=p+4|0;c[r>>2]=(c[r>>2]|0)+1}r=$g(o,d,e)|0;if(!q?(q=p+4|0,o=c[q>>2]|0,c[q>>2]=o+-1,(o|0)==0):0){Pa[c[(c[p>>2]|0)+8>>2]&255](p);mi(p)}if(r){i=1;break}r=m+-1|0;if((r|0)<=-1)break a;m=r;n=c[j>>2]|0}Ia=g;return i|0}while(0);if((((a[b+224>>0]|0?(s=+f[e>>2],t=+f[e+4>>2],u=+f[b+16>>2],u<=s):0)?u+ +f[b+24>>2]>=s:0)?(s=+f[b+20>>2],s<=t):0)?s+ +f[b+28>>2]>=t:0){di(16357)|0;a[b+225>>0]=1;j=c[b+248>>2]|0;if(!j){i=1;Ia=g;return i|0}Ra[c[(c[j>>2]|0)+24>>2]&31](j,e);i=1;Ia=g;return i|0}if((((a[b+144>>0]|0?(t=+f[e>>2],s=+f[e+4>>2],u=+f[b+16>>2],u<=t):0)?u+ +f[b+24>>2]>=t:0)?(t=+f[b+20>>2],t<=s):0)?t+ +f[b+28>>2]>=s:0){a[b+145>>0]=1;j=c[b+168>>2]|0;if(!j){i=1;Ia=g;return i|0}Pa[c[(c[j>>2]|0)+24>>2]&255](j);i=1;Ia=g;return i|0}if(!(a[b+64>>0]|0)){i=0;Ia=g;return i|0}s=+f[e>>2];t=+f[e+4>>2];u=+f[b+16>>2];if(!(u<=s)){i=0;Ia=g;return i|0}if(!(u+ +f[b+24>>2]>=s)){i=0;Ia=g;return i|0}s=+f[b+20>>2];if(!(s<=t)){i=0;Ia=g;return i|0}if(!(s+ +f[b+28>>2]>=t)){i=0;Ia=g;return i|0}c[h>>2]=b;bi(16294,h)|0;h=c[b+112>>2]|0;if(h|0)Pa[c[(c[h>>2]|0)+24>>2]&255](h);a[b+65>>0]=1;i=1;Ia=g;return i|0}function ah(b,d,e){b=b|0;d=d|0;e=e|0;var g=0,h=0,i=0.0,j=0.0,k=0.0,l=0,m=0,n=0,o=0,p=0,q=0;if(!(c[(c[d>>2]|0)+((c[b+4>>2]|0)*48|0)+40>>2]|0)){g=0;return g|0}if(a[b+144>>0]|0?(h=b+145|0,a[h>>0]|0):0){a[h>>0]=0;h=c[b+192>>2]|0;if(h|0)Pa[c[(c[h>>2]|0)+24>>2]&255](h);h=c[b+216>>2]|0;if(!h){g=1;return g|0}i=+f[e>>2];j=+f[e+4>>2];k=+f[b+16>>2];if(!(k<=i)){g=1;return g|0}if(!(k+ +f[b+24>>2]>=i)){g=1;return g|0}i=+f[b+20>>2];if(!(i<=j)){g=1;return g|0}if(!(i+ +f[b+28>>2]>=j)){g=1;return g|0}Ra[c[(c[h>>2]|0)+24>>2]&31](h,e);g=1;return g|0}if(a[b+64>>0]|0?(h=b+65|0,a[h>>0]|0):0){l=c[b+136>>2]|0;if(l|0)Pa[c[(c[l>>2]|0)+24>>2]&255](l);a[h>>0]=0;g=1;return g|0}if(a[b+224>>0]|0?(h=b+225|0,a[h>>0]|0):0){l=c[b+296>>2]|0;if(l|0)Ra[c[(c[l>>2]|0)+24>>2]&31](l,e);a[h>>0]=0;g=1;return g|0}h=b+312|0;l=c[h>>2]|0;m=(c[b+316>>2]|0)-l|0;if((m|0)<=0){g=0;return g|0}b=(m>>>3)+-1|0;m=l;while(1){l=c[m+(b<<3)>>2]|0;n=c[m+(b<<3)+4>>2]|0;o=(n|0)==0;if(!o){p=n+4|0;c[p>>2]=(c[p>>2]|0)+1}p=ah(l,d,e)|0;if(!o?(o=n+4|0,l=c[o>>2]|0,c[o>>2]=l+-1,(l|0)==0):0){Pa[c[(c[n>>2]|0)+8>>2]&255](n);mi(n)}if(p){g=1;q=32;break}p=b+-1|0;if((p|0)<=-1){g=0;q=32;break}b=p;m=c[h>>2]|0}if((q|0)==32)return g|0;return 0}function bh(b,d,e){b=b|0;d=d|0;e=+e;var f=0,g=0,h=0,i=0,j=0;if(!(c[(c[d>>2]|0)+((c[b+4>>2]|0)*48|0)+40>>2]|0))return;f=b+304|0;g=c[f>>2]|0;do if(g|0?(a[g+5>>0]|0)==0:0){h=(a[g+4>>0]|0)==0;Sa[c[c[g>>2]>>2]&3](g,d,e);if(h){Ua[c[(c[b>>2]|0)+8>>2]&15](b,d,b+44|0,b+36|0);break}h=c[f>>2]|0;a[h+5>>0]=1;i=c[h+24>>2]|0;if(i|0)Pa[c[(c[i>>2]|0)+24>>2]&255](i)}while(0);f=c[b+312>>2]|0;g=c[b+316>>2]|0;if((f|0)==(g|0))return;b=f;do{f=c[b>>2]|0;i=c[b+4>>2]|0;if(i){h=i+4|0;c[h>>2]=(c[h>>2]|0)+1;bh(f,d,e);h=i+4|0;j=c[h>>2]|0;c[h>>2]=j+-1;if(!j){Pa[c[(c[i>>2]|0)+8>>2]&255](i);mi(i)}}else bh(f,d,e);b=b+8|0}while((b|0)!=(g|0));return}function ch(){var b=0,d=0,e=0,f=0,g=0,h=0;b=Ia;Ia=Ia+16|0;if((Ia|0)>=(Ja|0))B(16);d=b;c[4578]=0;c[4579]=0;c[4580]=0;c[4581]=0;c[4582]=0;c[4583]=0;c[4584]=0;c[4585]=1065353216;e=ni(16)|0;c[d>>2]=e;c[d+8>>2]=-2147483632;c[d+4>>2]=12;f=e;g=6469;h=f+12|0;do{a[f>>0]=a[g>>0]|0;f=f+1|0;g=g+1|0}while((f|0)<(h|0));a[e+12>>0]=0;pi(18344,d);if((a[d+11>>0]|0)<0)oi(c[d>>2]|0);d=qi(18344)|0;c[4587]=d;e=1;g=d;do{g=(w(g>>>30^g,1812433253)|0)+e|0;c[18348+(e<<2)>>2]=g;e=e+1|0}while((e|0)!=624);c[5211]=0;c[4576]=0;Ia=b;return}function dh(a){a=a|0;var b=0,d=0;b=Ia;Ia=Ia+16|0;if((Ia|0)>=(Ja|0))B(16);d=b;c[d>>2]=ih(c[a+60>>2]|0)|0;a=gh(sa(6,d|0)|0)|0;Ia=b;return a|0}function eh(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0;e=Ia;Ia=Ia+48|0;if((Ia|0)>=(Ja|0))B(48);f=e+32|0;g=e+16|0;h=e;i=a+28|0;j=c[i>>2]|0;c[h>>2]=j;k=a+20|0;l=(c[k>>2]|0)-j|0;c[h+4>>2]=l;c[h+8>>2]=b;c[h+12>>2]=d;b=l+d|0;l=a+60|0;c[g>>2]=c[l>>2];c[g+4>>2]=h;c[g+8>>2]=2;j=gh(na(146,g|0)|0)|0;a:do if((b|0)!=(j|0)){g=2;m=b;n=h;o=j;while(1){if((o|0)<0)break;m=m-o|0;p=c[n+4>>2]|0;q=o>>>0>p>>>0;r=q?n+8|0:n;s=g+(q<<31>>31)|0;t=o-(q?p:0)|0;c[r>>2]=(c[r>>2]|0)+t;p=r+4|0;c[p>>2]=(c[p>>2]|0)-t;c[f>>2]=c[l>>2];c[f+4>>2]=r;c[f+8>>2]=s;o=gh(na(146,f|0)|0)|0;if((m|0)==(o|0)){u=3;break a}else{g=s;n=r}}c[a+16>>2]=0;c[i>>2]=0;c[k>>2]=0;c[a>>2]=c[a>>2]|32;if((g|0)==2)v=0;else v=d-(c[n+4>>2]|0)|0}else u=3;while(0);if((u|0)==3){u=c[a+44>>2]|0;c[a+16>>2]=u+(c[a+48>>2]|0);a=u;c[i>>2]=a;c[k>>2]=a;v=d}Ia=e;return v|0}function fh(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0;e=Ia;Ia=Ia+32|0;if((Ia|0)>=(Ja|0))B(32);f=e;g=e+20|0;c[f>>2]=c[a+60>>2];c[f+4>>2]=0;c[f+8>>2]=b;c[f+12>>2]=g;c[f+16>>2]=d;if((gh(ma(140,f|0)|0)|0)<0){c[g>>2]=-1;h=-1}else h=c[g>>2]|0;Ia=e;return h|0}function gh(a){a=a|0;var b=0;if(a>>>0>4294963200){c[(hh()|0)>>2]=0-a;b=-1}else b=a;return b|0}function hh(){return 20912}function ih(a){a=a|0;return a|0}function jh(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0;f=Ia;Ia=Ia+32|0;if((Ia|0)>=(Ja|0))B(32);g=f;c[b+36>>2]=1;if((c[b>>2]&64|0)==0?(c[g>>2]=c[b+60>>2],c[g+4>>2]=21523,c[g+8>>2]=f+16,ra(54,g|0)|0):0)a[b+75>>0]=-1;g=eh(b,d,e)|0;Ia=f;return g|0}function kh(a){a=a|0;return (a+-48|0)>>>0<10|0}function lh(){return 5720}function mh(b,c){b=b|0;c=c|0;var d=0,e=0,f=0,g=0;d=a[b>>0]|0;e=a[c>>0]|0;if(d<<24>>24==0?1:d<<24>>24!=e<<24>>24){f=e;g=d}else{d=c;c=b;do{c=c+1|0;d=d+1|0;b=a[c>>0]|0;e=a[d>>0]|0}while(!(b<<24>>24==0?1:b<<24>>24!=e<<24>>24));f=e;g=b}return (g&255)-(f&255)|0}function nh(b){b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0;d=b;a:do if(!(d&3)){e=b;f=5}else{g=b;h=d;while(1){if(!(a[g>>0]|0)){i=h;break a}j=g+1|0;h=j;if(!(h&3)){e=j;f=5;break}else g=j}}while(0);if((f|0)==5){f=e;while(1){k=c[f>>2]|0;if(!((k&-2139062144^-2139062144)&k+-16843009))f=f+4|0;else break}if(!((k&255)<<24>>24))l=f;else{k=f;while(1){f=k+1|0;if(!(a[f>>0]|0)){l=f;break}else k=f}}i=l}return i-d|0}function oh(a,b){a=a|0;b=b|0;var c=0;c=nh(a)|0;return ((ph(a,1,c,b)|0)!=(c|0))<<31>>31|0}function ph(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0;f=w(d,b)|0;g=(b|0)==0?0:d;if((c[e+76>>2]|0)>-1){d=(rh(e)|0)==0;h=uh(a,f,e)|0;if(d)i=h;else{qh(e);i=h}}else i=uh(a,f,e)|0;if((i|0)==(f|0))j=g;else j=(i>>>0)/(b>>>0)|0;return j|0}function qh(a){a=a|0;return}function rh(a){a=a|0;return 1}function sh(b,e){b=b|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0;f=Ia;Ia=Ia+16|0;if((Ia|0)>=(Ja|0))B(16);g=f;h=e&255;a[g>>0]=h;i=b+16|0;j=c[i>>2]|0;if(!j)if(!(th(b)|0)){k=c[i>>2]|0;l=4}else m=-1;else{k=j;l=4}do if((l|0)==4){j=b+20|0;i=c[j>>2]|0;if(i>>>0<k>>>0?(n=e&255,(n|0)!=(a[b+75>>0]|0)):0){c[j>>2]=i+1;a[i>>0]=h;m=n;break}if((Na[c[b+36>>2]&7](b,g,1)|0)==1)m=d[g>>0]|0;else m=-1}while(0);Ia=f;return m|0}function th(b){b=b|0;var d=0,e=0,f=0;d=b+74|0;e=a[d>>0]|0;a[d>>0]=e+255|e;e=c[b>>2]|0;if(!(e&8)){c[b+8>>2]=0;c[b+4>>2]=0;d=c[b+44>>2]|0;c[b+28>>2]=d;c[b+20>>2]=d;c[b+16>>2]=d+(c[b+48>>2]|0);f=0}else{c[b>>2]=e|32;f=-1}return f|0}function uh(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0;f=e+16|0;g=c[f>>2]|0;if(!g)if(!(th(e)|0)){h=c[f>>2]|0;i=5}else j=0;else{h=g;i=5}a:do if((i|0)==5){g=e+20|0;f=c[g>>2]|0;k=f;if((h-f|0)>>>0<d>>>0){j=Na[c[e+36>>2]&7](e,b,d)|0;break}b:do if((a[e+75>>0]|0)<0|(d|0)==0){l=0;m=b;n=d;o=k}else{f=d;while(1){p=f+-1|0;if((a[b+p>>0]|0)==10)break;if(!p){l=0;m=b;n=d;o=k;break b}else f=p}p=Na[c[e+36>>2]&7](e,b,f)|0;if(p>>>0<f>>>0){j=p;break a}l=f;m=b+f|0;n=d-f|0;o=c[g>>2]|0}while(0);Tj(o|0,m|0,n|0)|0;c[g>>2]=(c[g>>2]|0)+n;j=l+n|0}while(0);return j|0}function vh(a,b){a=a|0;b=b|0;var d=0;if(!b)d=0;else d=wh(c[b>>2]|0,c[b+4>>2]|0,a)|0;return ((d|0)==0?a:d)|0}function wh(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0;f=(c[b>>2]|0)+1794895138|0;g=xh(c[b+8>>2]|0,f)|0;h=xh(c[b+12>>2]|0,f)|0;i=xh(c[b+16>>2]|0,f)|0;a:do if((g>>>0<d>>>2>>>0?(j=d-(g<<2)|0,h>>>0<j>>>0&i>>>0<j>>>0):0)?((i|h)&3|0)==0:0){j=h>>>2;k=i>>>2;l=0;m=g;while(1){n=m>>>1;o=l+n|0;p=o<<1;q=p+j|0;r=xh(c[b+(q<<2)>>2]|0,f)|0;s=xh(c[b+(q+1<<2)>>2]|0,f)|0;if(!(s>>>0<d>>>0&r>>>0<(d-s|0)>>>0)){t=0;break a}if(a[b+(s+r)>>0]|0){t=0;break a}r=mh(e,b+s|0)|0;if(!r)break;s=(r|0)<0;if((m|0)==1){t=0;break a}l=s?l:o;m=s?n:m-n|0}m=p+k|0;l=xh(c[b+(m<<2)>>2]|0,f)|0;j=xh(c[b+(m+1<<2)>>2]|0,f)|0;if(j>>>0<d>>>0&l>>>0<(d-j|0)>>>0)t=(a[b+(j+l)>>0]|0)==0?b+j|0:0;else t=0}else t=0;while(0);return t|0}function xh(a,b){a=a|0;b=b|0;var c=0;c=Sj(a|0)|0;return ((b|0)==0?a:c)|0}function yh(){ja(20916);return 20924}function zh(){ta(20916);return}function Ah(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0;do if(a){if((c[a+76>>2]|0)<=-1){b=Bh(a)|0;break}d=(rh(a)|0)==0;e=Bh(a)|0;if(d)b=e;else{qh(a);b=e}}else{if(!(c[1429]|0))f=0;else f=Ah(c[1429]|0)|0;e=c[(yh()|0)>>2]|0;if(!e)g=f;else{d=e;e=f;while(1){if((c[d+76>>2]|0)>-1)h=rh(d)|0;else h=0;if((c[d+20>>2]|0)>>>0>(c[d+28>>2]|0)>>>0)i=Bh(d)|0|e;else i=e;if(h|0)qh(d);d=c[d+56>>2]|0;if(!d){g=i;break}else e=i}}zh();b=g}while(0);return b|0}function Bh(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0;b=a+20|0;d=a+28|0;if((c[b>>2]|0)>>>0>(c[d>>2]|0)>>>0?(Na[c[a+36>>2]&7](a,0,0)|0,(c[b>>2]|0)==0):0)e=-1;else{f=a+4|0;g=c[f>>2]|0;h=a+8|0;i=c[h>>2]|0;if(g>>>0<i>>>0)Na[c[a+40>>2]&7](a,g-i|0,1)|0;c[a+16>>2]=0;c[d>>2]=0;c[b>>2]=0;c[h>>2]=0;c[f>>2]=0;e=0}return e|0}function Ch(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,x=0,y=0;f=d&255;g=(e|0)!=0;a:do if(g&(b&3|0)!=0){h=d&255;i=b;j=e;while(1){if((a[i>>0]|0)==h<<24>>24){k=i;l=j;m=6;break a}n=i+1|0;o=j+-1|0;p=(o|0)!=0;if(p&(n&3|0)!=0){i=n;j=o}else{q=n;r=o;s=p;m=5;break}}}else{q=b;r=e;s=g;m=5}while(0);if((m|0)==5)if(s){k=q;l=r;m=6}else m=16;b:do if((m|0)==6){r=d&255;if((a[k>>0]|0)==r<<24>>24)if(!l){m=16;break}else{t=k;break}q=w(f,16843009)|0;c:do if(l>>>0>3){s=k;g=l;while(1){e=c[s>>2]^q;if((e&-2139062144^-2139062144)&e+-16843009|0){u=g;v=s;break c}e=s+4|0;b=g+-4|0;if(b>>>0>3){s=e;g=b}else{x=e;y=b;m=11;break}}}else{x=k;y=l;m=11}while(0);if((m|0)==11)if(!y){m=16;break}else{u=y;v=x}q=v;g=u;while(1){if((a[q>>0]|0)==r<<24>>24){t=q;break b}g=g+-1|0;if(!g){m=16;break}else q=q+1|0}}while(0);if((m|0)==16)t=0;return t|0}function Dh(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0;f=Ia;Ia=Ia+224|0;if((Ia|0)>=(Ja|0))B(224);g=f+208|0;h=f+160|0;i=f+80|0;j=f;k=h;l=k+40|0;do{c[k>>2]=0;k=k+4|0}while((k|0)<(l|0));c[g>>2]=c[e>>2];if((Eh(0,d,g,i,h)|0)<0)m=-1;else{if((c[b+76>>2]|0)>-1)n=rh(b)|0;else n=0;e=c[b>>2]|0;k=e&32;if((a[b+74>>0]|0)<1)c[b>>2]=e&-33;e=b+48|0;if(!(c[e>>2]|0)){l=b+44|0;o=c[l>>2]|0;c[l>>2]=j;p=b+28|0;c[p>>2]=j;q=b+20|0;c[q>>2]=j;c[e>>2]=80;r=b+16|0;c[r>>2]=j+80;j=Eh(b,d,g,i,h)|0;if(!o)s=j;else{Na[c[b+36>>2]&7](b,0,0)|0;t=(c[q>>2]|0)==0?-1:j;c[l>>2]=o;c[e>>2]=0;c[r>>2]=0;c[p>>2]=0;c[q>>2]=0;s=t}}else s=Eh(b,d,g,i,h)|0;h=c[b>>2]|0;c[b>>2]=h|k;if(n|0)qh(b);m=(h&32|0)==0?s:-1}Ia=f;return m|0}function Eh(d,e,f,h,i){d=d|0;e=e|0;f=f|0;h=h|0;i=i|0;var j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ba=0,ca=0,da=0,ea=0,fa=0,ga=0,ha=0,ia=0,ja=0,ka=0,la=0,ma=0,na=0,oa=0,pa=0,qa=0,ra=0,sa=0,ta=0,ua=0,va=0,wa=0,xa=0,ya=0,za=0,Aa=0,Ba=0,Ca=0,Da=0;j=Ia;Ia=Ia+64|0;if((Ia|0)>=(Ja|0))B(64);k=j+56|0;l=j+40|0;m=j;n=j+48|0;o=j+60|0;c[k>>2]=e;e=(d|0)!=0;p=m+40|0;q=p;r=m+39|0;m=n+4|0;s=0;t=0;u=0;a:while(1){v=s;w=t;while(1){do if((w|0)>-1)if((v|0)>(2147483647-w|0)){c[(hh()|0)>>2]=75;x=-1;break}else{x=v+w|0;break}else x=w;while(0);y=c[k>>2]|0;z=a[y>>0]|0;if(!(z<<24>>24)){C=94;break a}D=z;z=y;b:while(1){switch(D<<24>>24){case 37:{C=10;break b;break}case 0:{E=z;break b;break}default:{}}F=z+1|0;c[k>>2]=F;D=a[F>>0]|0;z=F}c:do if((C|0)==10){C=0;D=z;F=z;while(1){if((a[F+1>>0]|0)!=37){E=D;break c}G=D+1|0;F=F+2|0;c[k>>2]=F;if((a[F>>0]|0)!=37){E=G;break}else D=G}}while(0);v=E-y|0;if(e)Fh(d,y,v);if(!v)break;else w=x}w=(kh(a[(c[k>>2]|0)+1>>0]|0)|0)==0;v=c[k>>2]|0;if(!w?(a[v+2>>0]|0)==36:0){H=(a[v+1>>0]|0)+-48|0;I=1;J=3}else{H=-1;I=u;J=1}w=v+J|0;c[k>>2]=w;v=a[w>>0]|0;z=(v<<24>>24)+-32|0;if(z>>>0>31|(1<<z&75913|0)==0){K=0;L=v;M=w}else{v=0;D=z;z=w;while(1){w=1<<D|v;F=z+1|0;c[k>>2]=F;G=a[F>>0]|0;D=(G<<24>>24)+-32|0;if(D>>>0>31|(1<<D&75913|0)==0){K=w;L=G;M=F;break}else{v=w;z=F}}}if(L<<24>>24==42){if((kh(a[M+1>>0]|0)|0)!=0?(z=c[k>>2]|0,(a[z+2>>0]|0)==36):0){v=z+1|0;c[i+((a[v>>0]|0)+-48<<2)>>2]=10;N=c[h+((a[v>>0]|0)+-48<<3)>>2]|0;O=1;P=z+3|0}else{if(I|0){Q=-1;break}if(e){z=(c[f>>2]|0)+(4-1)&~(4-1);v=c[z>>2]|0;c[f>>2]=z+4;R=v}else R=0;N=R;O=0;P=(c[k>>2]|0)+1|0}c[k>>2]=P;v=(N|0)<0;S=v?0-N|0:N;T=v?K|8192:K;U=O;V=P}else{v=Gh(k)|0;if((v|0)<0){Q=-1;break}S=v;T=K;U=I;V=c[k>>2]|0}do if((a[V>>0]|0)==46){v=V+1|0;if((a[v>>0]|0)!=42){c[k>>2]=v;v=Gh(k)|0;W=v;X=c[k>>2]|0;break}if(kh(a[V+2>>0]|0)|0?(v=c[k>>2]|0,(a[v+3>>0]|0)==36):0){z=v+2|0;c[i+((a[z>>0]|0)+-48<<2)>>2]=10;D=c[h+((a[z>>0]|0)+-48<<3)>>2]|0;z=v+4|0;c[k>>2]=z;W=D;X=z;break}if(U|0){Q=-1;break a}if(e){z=(c[f>>2]|0)+(4-1)&~(4-1);D=c[z>>2]|0;c[f>>2]=z+4;Y=D}else Y=0;D=(c[k>>2]|0)+2|0;c[k>>2]=D;W=Y;X=D}else{W=-1;X=V}while(0);D=0;z=X;while(1){if(((a[z>>0]|0)+-65|0)>>>0>57){Q=-1;break a}v=z;z=z+1|0;c[k>>2]=z;Z=a[(a[v>>0]|0)+-65+(16+(D*58|0))>>0]|0;_=Z&255;if((_+-1|0)>>>0>=8)break;else D=_}if(!(Z<<24>>24)){Q=-1;break}v=(H|0)>-1;do if(Z<<24>>24==19)if(v){Q=-1;break a}else C=54;else{if(v){c[i+(H<<2)>>2]=_;F=h+(H<<3)|0;w=c[F+4>>2]|0;G=l;c[G>>2]=c[F>>2];c[G+4>>2]=w;C=54;break}if(!e){Q=0;break a}Hh(l,_,f);$=c[k>>2]|0;C=55}while(0);if((C|0)==54){C=0;if(e){$=z;C=55}else aa=0}d:do if((C|0)==55){C=0;v=a[$+-1>>0]|0;w=(D|0)!=0&(v&15|0)==3?v&-33:v;v=T&-65537;G=(T&8192|0)==0?T:v;e:do switch(w|0){case 110:{switch((D&255)<<24>>24){case 0:{c[c[l>>2]>>2]=x;aa=0;break d;break}case 1:{c[c[l>>2]>>2]=x;aa=0;break d;break}case 2:{F=c[l>>2]|0;c[F>>2]=x;c[F+4>>2]=((x|0)<0)<<31>>31;aa=0;break d;break}case 3:{b[c[l>>2]>>1]=x;aa=0;break d;break}case 4:{a[c[l>>2]>>0]=x;aa=0;break d;break}case 6:{c[c[l>>2]>>2]=x;aa=0;break d;break}case 7:{F=c[l>>2]|0;c[F>>2]=x;c[F+4>>2]=((x|0)<0)<<31>>31;aa=0;break d;break}default:{aa=0;break d}}break}case 112:{ba=120;ca=W>>>0>8?W:8;da=G|8;C=67;break}case 88:case 120:{ba=w;ca=W;da=G;C=67;break}case 111:{F=l;ea=c[F>>2]|0;fa=c[F+4>>2]|0;F=Jh(ea,fa,p)|0;ga=q-F|0;ha=F;ia=0;ja=16376;ka=(G&8|0)==0|(W|0)>(ga|0)?W:ga+1|0;la=G;ma=ea;na=fa;C=73;break}case 105:case 100:{fa=l;ea=c[fa>>2]|0;ga=c[fa+4>>2]|0;if((ga|0)<0){fa=Mj(0,0,ea|0,ga|0)|0;F=A()|0;oa=l;c[oa>>2]=fa;c[oa+4>>2]=F;pa=1;qa=16376;ra=fa;sa=F;C=72;break e}else{pa=(G&2049|0)!=0&1;qa=(G&2048|0)==0?((G&1|0)==0?16376:16378):16377;ra=ea;sa=ga;C=72;break e}break}case 117:{ga=l;pa=0;qa=16376;ra=c[ga>>2]|0;sa=c[ga+4>>2]|0;C=72;break}case 99:{a[r>>0]=c[l>>2];ta=r;ua=0;va=16376;wa=1;xa=v;ya=q;break}case 109:{za=Lh(c[(hh()|0)>>2]|0)|0;C=77;break}case 115:{ga=c[l>>2]|0;za=(ga|0)==0?16386:ga;C=77;break}case 67:{c[n>>2]=c[l>>2];c[m>>2]=0;c[l>>2]=n;Aa=-1;C=81;break}case 83:{if(!W){Mh(d,32,S,0,G);Ba=0;C=91}else{Aa=W;C=81}break}case 65:case 71:case 70:case 69:case 97:case 103:case 102:case 101:{aa=Oh(d,+g[l>>3],S,W,G,w)|0;break d;break}default:{ta=y;ua=0;va=16376;wa=W;xa=G;ya=q}}while(0);f:do if((C|0)==67){C=0;w=l;ga=c[w>>2]|0;ea=c[w+4>>2]|0;w=Ih(ga,ea,p,ba&32)|0;F=(da&8|0)==0|(ga|0)==0&(ea|0)==0;ha=w;ia=F?0:2;ja=F?16376:16376+(ba>>>4)|0;ka=ca;la=da;ma=ga;na=ea;C=73}else if((C|0)==72){C=0;ha=Kh(ra,sa,p)|0;ia=pa;ja=qa;ka=W;la=G;ma=ra;na=sa;C=73}else if((C|0)==77){C=0;ea=Ch(za,0,W)|0;ga=(ea|0)==0;ta=za;ua=0;va=16376;wa=ga?W:ea-za|0;xa=v;ya=ga?za+W|0:ea}else if((C|0)==81){C=0;ea=c[l>>2]|0;ga=0;while(1){F=c[ea>>2]|0;if(!F){Ca=ga;break}w=Nh(o,F)|0;Da=(w|0)<0;if(Da|w>>>0>(Aa-ga|0)>>>0){C=85;break}F=w+ga|0;if(Aa>>>0>F>>>0){ea=ea+4|0;ga=F}else{Ca=F;break}}if((C|0)==85){C=0;if(Da){Q=-1;break a}else Ca=ga}Mh(d,32,S,Ca,G);if(!Ca){Ba=0;C=91}else{ea=c[l>>2]|0;F=0;while(1){w=c[ea>>2]|0;if(!w){Ba=Ca;C=91;break f}fa=Nh(o,w)|0;F=fa+F|0;if((F|0)>(Ca|0)){Ba=Ca;C=91;break f}Fh(d,o,fa);if(F>>>0>=Ca>>>0){Ba=Ca;C=91;break}else ea=ea+4|0}}}while(0);if((C|0)==73){C=0;v=(ma|0)!=0|(na|0)!=0;ea=(ka|0)!=0|v;F=q-ha+((v^1)&1)|0;ta=ea?ha:p;ua=ia;va=ja;wa=ea?((ka|0)>(F|0)?ka:F):0;xa=(ka|0)>-1?la&-65537:la;ya=q}else if((C|0)==91){C=0;Mh(d,32,S,Ba,G^8192);aa=(S|0)>(Ba|0)?S:Ba;break}F=ya-ta|0;ea=(wa|0)<(F|0)?F:wa;v=ea+ua|0;ga=(S|0)<(v|0)?v:S;Mh(d,32,ga,v,xa);Fh(d,va,ua);Mh(d,48,ga,v,xa^65536);Mh(d,48,ea,F,0);Fh(d,ta,F);Mh(d,32,ga,v,xa^8192);aa=ga}while(0);s=aa;t=x;u=U}g:do if((C|0)==94)if(!d)if(!u)Q=0;else{U=1;while(1){t=c[i+(U<<2)>>2]|0;if(!t)break;Hh(h+(U<<3)|0,t,f);t=U+1|0;if(t>>>0<10)U=t;else{Q=1;break g}}t=U;while(1){if(c[i+(t<<2)>>2]|0){Q=-1;break g}t=t+1|0;if(t>>>0>=10){Q=1;break}}}else Q=x;while(0);Ia=j;return Q|0}function Fh(a,b,d){a=a|0;b=b|0;d=d|0;if(!(c[a>>2]&32))uh(b,d,a)|0;return}function Gh(b){b=b|0;var d=0,e=0,f=0,g=0,h=0;if(!(kh(a[c[b>>2]>>0]|0)|0))d=0;else{e=0;while(1){f=c[b>>2]|0;g=(e*10|0)+-48+(a[f>>0]|0)|0;h=f+1|0;c[b>>2]=h;if(!(kh(a[h>>0]|0)|0)){d=g;break}else e=g}}return d|0}function Hh(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,h=0,i=0,j=0.0;a:do if(b>>>0<=20)do switch(b|0){case 9:{e=(c[d>>2]|0)+(4-1)&~(4-1);f=c[e>>2]|0;c[d>>2]=e+4;c[a>>2]=f;break a;break}case 10:{f=(c[d>>2]|0)+(4-1)&~(4-1);e=c[f>>2]|0;c[d>>2]=f+4;f=a;c[f>>2]=e;c[f+4>>2]=((e|0)<0)<<31>>31;break a;break}case 11:{e=(c[d>>2]|0)+(4-1)&~(4-1);f=c[e>>2]|0;c[d>>2]=e+4;e=a;c[e>>2]=f;c[e+4>>2]=0;break a;break}case 12:{e=(c[d>>2]|0)+(8-1)&~(8-1);f=e;h=c[f>>2]|0;i=c[f+4>>2]|0;c[d>>2]=e+8;e=a;c[e>>2]=h;c[e+4>>2]=i;break a;break}case 13:{i=(c[d>>2]|0)+(4-1)&~(4-1);e=c[i>>2]|0;c[d>>2]=i+4;i=(e&65535)<<16>>16;e=a;c[e>>2]=i;c[e+4>>2]=((i|0)<0)<<31>>31;break a;break}case 14:{i=(c[d>>2]|0)+(4-1)&~(4-1);e=c[i>>2]|0;c[d>>2]=i+4;i=a;c[i>>2]=e&65535;c[i+4>>2]=0;break a;break}case 15:{i=(c[d>>2]|0)+(4-1)&~(4-1);e=c[i>>2]|0;c[d>>2]=i+4;i=(e&255)<<24>>24;e=a;c[e>>2]=i;c[e+4>>2]=((i|0)<0)<<31>>31;break a;break}case 16:{i=(c[d>>2]|0)+(4-1)&~(4-1);e=c[i>>2]|0;c[d>>2]=i+4;i=a;c[i>>2]=e&255;c[i+4>>2]=0;break a;break}case 17:{i=(c[d>>2]|0)+(8-1)&~(8-1);j=+g[i>>3];c[d>>2]=i+8;g[a>>3]=j;break a;break}case 18:{i=(c[d>>2]|0)+(8-1)&~(8-1);j=+g[i>>3];c[d>>2]=i+8;g[a>>3]=j;break a;break}default:break a}while(0);while(0);return}function Ih(b,c,e,f){b=b|0;c=c|0;e=e|0;f=f|0;var g=0,h=0;if((b|0)==0&(c|0)==0)g=e;else{h=e;e=c;c=b;while(1){b=h+-1|0;a[b>>0]=d[480+(c&15)>>0]|0|f;c=Qj(c|0,e|0,4)|0;e=A()|0;if((c|0)==0&(e|0)==0){g=b;break}else h=b}}return g|0}function Jh(b,c,d){b=b|0;c=c|0;d=d|0;var e=0,f=0;if((b|0)==0&(c|0)==0)e=d;else{f=d;d=c;c=b;while(1){b=f+-1|0;a[b>>0]=c&7|48;c=Qj(c|0,d|0,3)|0;d=A()|0;if((c|0)==0&(d|0)==0){e=b;break}else f=b}}return e|0}function Kh(b,c,d){b=b|0;c=c|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;if(c>>>0>0|(c|0)==0&b>>>0>4294967295){e=d;f=b;g=c;do{c=f;f=Pj(f|0,g|0,10,0)|0;h=g;g=A()|0;i=Kj(f|0,g|0,10,0)|0;j=Mj(c|0,h|0,i|0,A()|0)|0;A()|0;e=e+-1|0;a[e>>0]=j&255|48}while(h>>>0>9|(h|0)==9&c>>>0>4294967295);k=f;l=e}else{k=b;l=d}if(!k)m=l;else{d=k;k=l;while(1){l=d;d=(d>>>0)/10|0;b=k+-1|0;a[b>>0]=l-(d*10|0)|48;if(l>>>0<10){m=b;break}else k=b}}return m|0}function Lh(a){a=a|0;return Vh(a,c[(Uh()|0)+188>>2]|0)|0}function Mh(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;var f=0,g=0,h=0;f=Ia;Ia=Ia+256|0;if((Ia|0)>=(Ja|0))B(256);g=f;if((c|0)>(d|0)&(e&73728|0)==0){e=c-d|0;Uj(g|0,b<<24>>24|0,(e>>>0<256?e:256)|0)|0;if(e>>>0>255){b=c-d|0;d=e;do{Fh(a,g,256);d=d+-256|0}while(d>>>0>255);h=b&255}else h=e;Fh(a,g,h)}Ia=f;return}function Nh(a,b){a=a|0;b=b|0;var c=0;if(!a)c=0;else c=Sh(a,b,0)|0;return c|0}function Oh(b,e,f,g,h,i){b=b|0;e=+e;f=f|0;g=g|0;h=h|0;i=i|0;var j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0.0,t=0,u=0.0,v=0,x=0,y=0,z=0,C=0,D=0,E=0,F=0,G=0.0,H=0,I=0,J=0,K=0.0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0.0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ba=0,ca=0,da=0,ea=0,fa=0,ga=0,ha=0,ia=0.0,ja=0.0,ka=0,la=0,ma=0,na=0,oa=0,pa=0,qa=0,ra=0,sa=0,ta=0,ua=0,va=0,wa=0,xa=0,ya=0,za=0,Aa=0,Ba=0,Ca=0,Da=0,Ea=0,Fa=0,Ga=0,Ha=0,Ka=0;j=Ia;Ia=Ia+560|0;if((Ia|0)>=(Ja|0))B(560);k=j+32|0;l=j+536|0;m=j;n=m;o=j+540|0;c[l>>2]=0;p=o+12|0;q=Ph(e)|0;r=A()|0;if((r|0)<0){s=-e;t=Ph(s)|0;u=s;v=1;x=16393;y=A()|0;z=t}else{u=e;v=(h&2049|0)!=0&1;x=(h&2048|0)==0?((h&1|0)==0?16394:16399):16396;y=r;z=q}do if(0==0&(y&2146435072|0)==2146435072){q=(i&32|0)!=0;z=v+3|0;Mh(b,32,f,z,h&-65537);Fh(b,x,v);Fh(b,u!=u|0.0!=0.0?(q?16420:16424):q?16412:16416,3);Mh(b,32,f,z,h^8192);C=z}else{e=+Qh(u,l)*2.0;z=e!=0.0;if(z)c[l>>2]=(c[l>>2]|0)+-1;q=i|32;if((q|0)==97){r=i&32;t=(r|0)==0?x:x+9|0;D=v|2;E=12-g|0;do if(!(g>>>0>11|(E|0)==0)){s=8.0;F=E;do{F=F+-1|0;s=s*16.0}while((F|0)!=0);if((a[t>>0]|0)==45){G=-(s+(-e-s));break}else{G=e+s-s;break}}else G=e;while(0);E=c[l>>2]|0;F=(E|0)<0?0-E|0:E;H=Kh(F,((F|0)<0)<<31>>31,p)|0;if((H|0)==(p|0)){F=o+11|0;a[F>>0]=48;I=F}else I=H;a[I+-1>>0]=(E>>31&2)+43;E=I+-2|0;a[E>>0]=i+15;H=(g|0)<1;F=(h&8|0)==0;J=m;K=G;while(1){L=~~K;M=J+1|0;a[J>>0]=r|d[480+L>>0];K=(K-+(L|0))*16.0;if((M-n|0)==1?!(F&(H&K==0.0)):0){a[M>>0]=46;N=J+2|0}else N=M;if(!(K!=0.0))break;else J=N}J=N;if((g|0)!=0?(-2-n+J|0)<(g|0):0){H=p;F=E;O=g+2+H-F|0;P=H;Q=F}else{F=p;H=E;O=F-n-H+J|0;P=F;Q=H}H=O+D|0;Mh(b,32,f,H,h);Fh(b,t,D);Mh(b,48,f,H,h^65536);F=J-n|0;Fh(b,m,F);J=P-Q|0;Mh(b,48,O-(F+J)|0,0,0);Fh(b,E,J);Mh(b,32,f,H,h^8192);C=H;break}H=(g|0)<0?6:g;if(z){J=(c[l>>2]|0)+-28|0;c[l>>2]=J;R=e*268435456.0;S=J}else{R=e;S=c[l>>2]|0}J=(S|0)<0?k:k+288|0;F=J;K=R;do{r=~~K>>>0;c[F>>2]=r;F=F+4|0;K=(K-+(r>>>0))*1.0e9}while(K!=0.0);z=J;if((S|0)>0){E=J;D=F;t=S;while(1){r=(t|0)<29?t:29;M=D+-4|0;if(M>>>0>=E>>>0){L=M;M=0;do{T=Rj(c[L>>2]|0,0,r|0)|0;U=Lj(T|0,A()|0,M|0,0)|0;T=A()|0;M=Pj(U|0,T|0,1e9,0)|0;V=Kj(M|0,A()|0,1e9,0)|0;W=Mj(U|0,T|0,V|0,A()|0)|0;A()|0;c[L>>2]=W;L=L+-4|0}while(L>>>0>=E>>>0);if(M){L=E+-4|0;c[L>>2]=M;X=L}else X=E}else X=E;a:do if(D>>>0>X>>>0){L=D;while(1){W=L+-4|0;if(c[W>>2]|0){Y=L;break a}if(W>>>0>X>>>0)L=W;else{Y=W;break}}}else Y=D;while(0);M=(c[l>>2]|0)-r|0;c[l>>2]=M;if((M|0)>0){E=X;D=Y;t=M}else{Z=X;_=Y;$=M;break}}}else{Z=J;_=F;$=S}if(($|0)<0){t=((H+25|0)/9|0)+1|0;D=(q|0)==102;E=Z;M=_;L=$;while(1){W=0-L|0;V=(W|0)<9?W:9;if(E>>>0<M>>>0){W=(1<<V)+-1|0;T=1e9>>>V;U=0;aa=E;do{ba=c[aa>>2]|0;c[aa>>2]=(ba>>>V)+U;U=w(ba&W,T)|0;aa=aa+4|0}while(aa>>>0<M>>>0);aa=(c[E>>2]|0)==0?E+4|0:E;if(!U){ca=M;da=aa}else{c[M>>2]=U;ca=M+4|0;da=aa}}else{ca=M;da=(c[E>>2]|0)==0?E+4|0:E}aa=D?J:da;T=(ca-aa>>2|0)>(t|0)?aa+(t<<2)|0:ca;L=(c[l>>2]|0)+V|0;c[l>>2]=L;if((L|0)>=0){ea=da;fa=T;break}else{E=da;M=T}}}else{ea=Z;fa=_}if(ea>>>0<fa>>>0){M=(z-ea>>2)*9|0;E=c[ea>>2]|0;if(E>>>0<10)ga=M;else{L=M;M=10;while(1){M=M*10|0;t=L+1|0;if(E>>>0<M>>>0){ga=t;break}else L=t}}}else ga=0;L=(q|0)==103;M=(H|0)!=0;E=H-((q|0)==102?0:ga)+((M&L)<<31>>31)|0;if((E|0)<(((fa-z>>2)*9|0)+-9|0)){t=E+9216|0;E=(t|0)/9|0;D=J+4+(E+-1024<<2)|0;F=t-(E*9|0)|0;if((F|0)<8){E=F;F=10;while(1){t=F*10|0;if((E|0)<7){E=E+1|0;F=t}else{ha=t;break}}}else ha=10;F=c[D>>2]|0;E=(F>>>0)/(ha>>>0)|0;q=F-(w(E,ha)|0)|0;t=(D+4|0)==(fa|0);if(!(t&(q|0)==0)){s=(E&1|0)==0?9007199254740992.0:9007199254740994.0;E=ha>>>1;K=q>>>0<E>>>0?.5:t&(q|0)==(E|0)?1.0:1.5;if(!v){ia=K;ja=s}else{E=(a[x>>0]|0)==45;ia=E?-K:K;ja=E?-s:s}E=F-q|0;c[D>>2]=E;if(ja+ia!=ja){q=E+ha|0;c[D>>2]=q;if(q>>>0>999999999){q=D;E=ea;while(1){F=q+-4|0;c[q>>2]=0;if(F>>>0<E>>>0){t=E+-4|0;c[t>>2]=0;ka=t}else ka=E;t=(c[F>>2]|0)+1|0;c[F>>2]=t;if(t>>>0>999999999){q=F;E=ka}else{la=F;ma=ka;break}}}else{la=D;ma=ea}E=(z-ma>>2)*9|0;q=c[ma>>2]|0;if(q>>>0<10){na=la;oa=E;pa=ma}else{F=E;E=10;while(1){E=E*10|0;t=F+1|0;if(q>>>0<E>>>0){na=la;oa=t;pa=ma;break}else F=t}}}else{na=D;oa=ga;pa=ea}}else{na=D;oa=ga;pa=ea}F=na+4|0;qa=oa;ra=fa>>>0>F>>>0?F:fa;sa=pa}else{qa=ga;ra=fa;sa=ea}F=0-qa|0;b:do if(ra>>>0>sa>>>0){E=ra;while(1){q=E+-4|0;if(c[q>>2]|0){ta=E;ua=1;break b}if(q>>>0>sa>>>0)E=q;else{ta=q;ua=0;break}}}else{ta=ra;ua=0}while(0);do if(L){D=H+((M^1)&1)|0;if((D|0)>(qa|0)&(qa|0)>-5){va=i+-1|0;wa=D+-1-qa|0}else{va=i+-2|0;wa=D+-1|0}if(!(h&8)){if(ua?(D=c[ta+-4>>2]|0,(D|0)!=0):0)if(!((D>>>0)%10|0)){E=0;V=10;while(1){V=V*10|0;U=E+1|0;if((D>>>0)%(V>>>0)|0|0){xa=U;break}else E=U}}else xa=0;else xa=9;E=((ta-z>>2)*9|0)+-9|0;if((va|32|0)==102){V=E-xa|0;D=(V|0)>0?V:0;ya=va;za=(wa|0)<(D|0)?wa:D;break}else{D=E+qa-xa|0;E=(D|0)>0?D:0;ya=va;za=(wa|0)<(E|0)?wa:E;break}}else{ya=va;za=wa}}else{ya=i;za=H}while(0);H=(za|0)!=0;z=H?1:h>>>3&1;M=(ya|32|0)==102;if(M){Aa=0;Ba=(qa|0)>0?qa:0}else{L=(qa|0)<0?F:qa;E=Kh(L,((L|0)<0)<<31>>31,p)|0;L=p;if((L-E|0)<2){D=E;while(1){V=D+-1|0;a[V>>0]=48;if((L-V|0)<2)D=V;else{Ca=V;break}}}else Ca=E;a[Ca+-1>>0]=(qa>>31&2)+43;D=Ca+-2|0;a[D>>0]=ya;Aa=D;Ba=L-D|0}D=v+1+za+z+Ba|0;Mh(b,32,f,D,h);Fh(b,x,v);Mh(b,48,f,D,h^65536);if(M){F=sa>>>0>J>>>0?J:sa;V=m+9|0;U=V;q=m+8|0;t=F;do{T=Kh(c[t>>2]|0,0,V)|0;if((t|0)==(F|0))if((T|0)==(V|0)){a[q>>0]=48;Da=q}else Da=T;else if(T>>>0>m>>>0){Uj(m|0,48,T-n|0)|0;aa=T;while(1){W=aa+-1|0;if(W>>>0>m>>>0)aa=W;else{Da=W;break}}}else Da=T;Fh(b,Da,U-Da|0);t=t+4|0}while(t>>>0<=J>>>0);if(!((h&8|0)==0&(H^1)))Fh(b,16428,1);if(t>>>0<ta>>>0&(za|0)>0){J=za;U=t;while(1){q=Kh(c[U>>2]|0,0,V)|0;if(q>>>0>m>>>0){Uj(m|0,48,q-n|0)|0;F=q;while(1){M=F+-1|0;if(M>>>0>m>>>0)F=M;else{Ea=M;break}}}else Ea=q;Fh(b,Ea,(J|0)<9?J:9);U=U+4|0;F=J+-9|0;if(!(U>>>0<ta>>>0&(J|0)>9)){Fa=F;break}else J=F}}else Fa=za;Mh(b,48,Fa+9|0,9,0)}else{J=ua?ta:sa+4|0;if(sa>>>0<J>>>0&(za|0)>-1){U=m+9|0;V=(h&8|0)==0;t=U;H=0-n|0;F=m+8|0;T=za;M=sa;while(1){z=Kh(c[M>>2]|0,0,U)|0;if((z|0)==(U|0)){a[F>>0]=48;Ga=F}else Ga=z;do if((M|0)==(sa|0)){z=Ga+1|0;Fh(b,Ga,1);if(V&(T|0)<1){Ha=z;break}Fh(b,16428,1);Ha=z}else{if(Ga>>>0<=m>>>0){Ha=Ga;break}Uj(m|0,48,Ga+H|0)|0;z=Ga;while(1){L=z+-1|0;if(L>>>0>m>>>0)z=L;else{Ha=L;break}}}while(0);q=t-Ha|0;Fh(b,Ha,(T|0)>(q|0)?q:T);z=T-q|0;M=M+4|0;if(!(M>>>0<J>>>0&(z|0)>-1)){Ka=z;break}else T=z}}else Ka=za;Mh(b,48,Ka+18|0,18,0);Fh(b,Aa,p-Aa|0)}Mh(b,32,f,D,h^8192);C=D}while(0);Ia=j;return ((C|0)<(f|0)?f:C)|0}function Ph(a){a=+a;var b=0;g[h>>3]=a;b=c[h>>2]|0;z(c[h+4>>2]|0);return b|0}function Qh(a,b){a=+a;b=b|0;return +(+Rh(a,b))}function Rh(a,b){a=+a;b=b|0;var d=0,e=0,f=0,i=0.0,j=0.0,k=0,l=0.0;g[h>>3]=a;d=c[h>>2]|0;e=c[h+4>>2]|0;f=Qj(d|0,e|0,52)|0;A()|0;switch(f&2047){case 0:{if(a!=0.0){i=+Rh(a*18446744073709551616.0,b);j=i;k=(c[b>>2]|0)+-64|0}else{j=a;k=0}c[b>>2]=k;l=j;break}case 2047:{l=a;break}default:{c[b>>2]=(f&2047)+-1022;c[h>>2]=d;c[h+4>>2]=e&-2146435073|1071644672;l=+g[h>>3]}}return +l}function Sh(b,d,e){b=b|0;d=d|0;e=e|0;var f=0;do if(b){if(d>>>0<128){a[b>>0]=d;f=1;break}if(!(c[c[(Th()|0)+188>>2]>>2]|0))if((d&-128|0)==57216){a[b>>0]=d;f=1;break}else{c[(hh()|0)>>2]=84;f=-1;break}if(d>>>0<2048){a[b>>0]=d>>>6|192;a[b+1>>0]=d&63|128;f=2;break}if(d>>>0<55296|(d&-8192|0)==57344){a[b>>0]=d>>>12|224;a[b+1>>0]=d>>>6&63|128;a[b+2>>0]=d&63|128;f=3;break}if((d+-65536|0)>>>0<1048576){a[b>>0]=d>>>18|240;a[b+1>>0]=d>>>12&63|128;a[b+2>>0]=d>>>6&63|128;a[b+3>>0]=d&63|128;f=4;break}else{c[(hh()|0)>>2]=84;f=-1;break}}else f=1;while(0);return f|0}function Th(){return lh()|0}function Uh(){return lh()|0}function Vh(b,e){b=b|0;e=e|0;var f=0,g=0,h=0,i=0,j=0;f=0;while(1){if((d[496+f>>0]|0)==(b|0)){g=4;break}h=f+1|0;if((h|0)==87){i=87;g=5;break}else f=h}if((g|0)==4)if(!f)j=592;else{i=f;g=5}if((g|0)==5){g=592;f=i;while(1){i=g;do{b=i;i=i+1|0}while((a[b>>0]|0)!=0);f=f+-1|0;if(!f){j=i;break}else g=i}}return Wh(j,c[e+20>>2]|0)|0}function Wh(a,b){a=a|0;b=b|0;return vh(a,b)|0}function Xh(b,c,d){b=b|0;c=c|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0;a:do if(!d)e=0;else{f=b;g=d;h=c;while(1){i=a[f>>0]|0;j=a[h>>0]|0;if(i<<24>>24!=j<<24>>24)break;g=g+-1|0;if(!g){e=0;break a}else{f=f+1|0;h=h+1|0}}e=(i&255)-(j&255)|0}while(0);return e|0}function Yh(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0;e=Ia;Ia=Ia+48|0;if((Ia|0)>=(Ja|0))B(48);f=e+32|0;g=e+16|0;h=e;if(!(b&4194368))i=0;else{c[h>>2]=d;d=(c[h>>2]|0)+(4-1)&~(4-1);j=c[d>>2]|0;c[h>>2]=d+4;i=j}c[g>>2]=a;c[g+4>>2]=b|32768;c[g+8>>2]=i;i=qa(5,g|0)|0;if(!((b&524288|0)==0|(i|0)<0)){c[f>>2]=i;c[f+4>>2]=2;c[f+8>>2]=1;oa(221,f|0)|0}f=gh(i)|0;Ia=e;return f|0}function Zh(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0;f=Ia;Ia=Ia+16|0;if((Ia|0)>=(Ja|0))B(16);g=f;c[g>>2]=e;e=_h(a,b,d,g)|0;Ia=f;return e|0}function _h(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0;g=Ia;Ia=Ia+128|0;if((Ia|0)>=(Ja|0))B(128);h=g+124|0;i=g;j=i;k=5964;l=j+124|0;do{c[j>>2]=c[k>>2];j=j+4|0;k=k+4|0}while((j|0)<(l|0));if((d+-1|0)>>>0>2147483646)if(!d){m=h;n=1;o=4}else{c[(hh()|0)>>2]=75;p=-1}else{m=b;n=d;o=4}if((o|0)==4){o=-2-m|0;d=n>>>0>o>>>0?o:n;c[i+48>>2]=d;n=i+20|0;c[n>>2]=m;c[i+44>>2]=m;o=m+d|0;m=i+16|0;c[m>>2]=o;c[i+28>>2]=o;o=Dh(i,e,f)|0;if(!d)p=o;else{d=c[n>>2]|0;a[d+(((d|0)==(c[m>>2]|0))<<31>>31)>>0]=0;p=o}}Ia=g;return p|0}function $h(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0;e=a+20|0;f=c[e>>2]|0;g=(c[a+16>>2]|0)-f|0;a=g>>>0>d>>>0?d:g;Tj(f|0,b|0,a|0)|0;c[e>>2]=(c[e>>2]|0)+a;return d|0}function ai(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;e=Ia;Ia=Ia+16|0;if((Ia|0)>=(Ja|0))B(16);f=e;c[f>>2]=a;c[f+4>>2]=b;c[f+8>>2]=d;d=gh(pa(3,f|0)|0)|0;Ia=e;return d|0}function bi(a,b){a=a|0;b=b|0;var d=0,e=0;d=Ia;Ia=Ia+16|0;if((Ia|0)>=(Ja|0))B(16);e=d;c[e>>2]=b;b=Dh(c[1397]|0,a,e)|0;Ia=d;return b|0}function ci(b,d){b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0;if((c[d+76>>2]|0)>=0?(rh(d)|0)!=0:0){e=b&255;f=b&255;if((f|0)!=(a[d+75>>0]|0)?(g=d+20|0,h=c[g>>2]|0,h>>>0<(c[d+16>>2]|0)>>>0):0){c[g>>2]=h+1;a[h>>0]=e;i=f}else i=sh(d,b)|0;qh(d);j=i}else k=3;do if((k|0)==3){i=b&255;f=b&255;if((f|0)!=(a[d+75>>0]|0)?(e=d+20|0,h=c[e>>2]|0,h>>>0<(c[d+16>>2]|0)>>>0):0){c[e>>2]=h+1;a[h>>0]=i;j=f;break}j=sh(d,b)|0}while(0);return j|0}function di(b){b=b|0;var d=0,e=0,f=0,g=0,h=0;d=c[1397]|0;if((c[d+76>>2]|0)>-1)e=rh(d)|0;else e=0;do if((oh(b,d)|0)<0)f=-1;else{if((a[d+75>>0]|0)!=10?(g=d+20|0,h=c[g>>2]|0,h>>>0<(c[d+16>>2]|0)>>>0):0){c[g>>2]=h+1;a[h>>0]=10;f=0;break}f=(sh(d,10)|0)>>31}while(0);if(e|0)qh(d);return f|0}function ei(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ba=0,ca=0,da=0,ea=0,fa=0,ga=0,ha=0,ia=0,ja=0,ka=0,la=0,ma=0,na=0,oa=0,pa=0,qa=0,ra=0,sa=0,ta=0,ua=0,va=0,wa=0,xa=0,ya=0,za=0,Aa=0,Ba=0,Ca=0,Da=0,Ea=0,Fa=0,Ga=0,Ha=0,Ka=0,La=0;b=Ia;Ia=Ia+16|0;if((Ia|0)>=(Ja|0))B(16);d=b;do if(a>>>0<245){e=a>>>0<11?16:a+11&-8;f=e>>>3;g=c[5232]|0;h=g>>>f;if(h&3|0){i=(h&1^1)+f|0;j=20968+(i<<1<<2)|0;k=j+8|0;l=c[k>>2]|0;m=l+8|0;n=c[m>>2]|0;if((n|0)==(j|0))c[5232]=g&~(1<<i);else{c[n+12>>2]=j;c[k>>2]=n}n=i<<3;c[l+4>>2]=n|3;i=l+n+4|0;c[i>>2]=c[i>>2]|1;o=m;Ia=b;return o|0}m=c[5234]|0;if(e>>>0>m>>>0){if(h|0){i=2<<f;n=h<<f&(i|0-i);i=(n&0-n)+-1|0;n=i>>>12&16;f=i>>>n;i=f>>>5&8;h=f>>>i;f=h>>>2&4;l=h>>>f;h=l>>>1&2;k=l>>>h;l=k>>>1&1;j=(i|n|f|h|l)+(k>>>l)|0;l=20968+(j<<1<<2)|0;k=l+8|0;h=c[k>>2]|0;f=h+8|0;n=c[f>>2]|0;if((n|0)==(l|0)){i=g&~(1<<j);c[5232]=i;p=i}else{c[n+12>>2]=l;c[k>>2]=n;p=g}n=j<<3;j=n-e|0;c[h+4>>2]=e|3;k=h+e|0;c[k+4>>2]=j|1;c[h+n>>2]=j;if(m|0){n=c[5237]|0;h=m>>>3;l=20968+(h<<1<<2)|0;i=1<<h;if(!(p&i)){c[5232]=p|i;q=l;r=l+8|0}else{i=l+8|0;q=c[i>>2]|0;r=i}c[r>>2]=n;c[q+12>>2]=n;c[n+8>>2]=q;c[n+12>>2]=l}c[5234]=j;c[5237]=k;o=f;Ia=b;return o|0}f=c[5233]|0;if(f){k=(f&0-f)+-1|0;j=k>>>12&16;l=k>>>j;k=l>>>5&8;n=l>>>k;l=n>>>2&4;i=n>>>l;n=i>>>1&2;h=i>>>n;i=h>>>1&1;s=c[21232+((k|j|l|n|i)+(h>>>i)<<2)>>2]|0;i=s;h=s;n=(c[s+4>>2]&-8)-e|0;while(1){s=c[i+16>>2]|0;if(!s){l=c[i+20>>2]|0;if(!l)break;else t=l}else t=s;s=(c[t+4>>2]&-8)-e|0;l=s>>>0<n>>>0;i=t;h=l?t:h;n=l?s:n}i=h+e|0;if(i>>>0>h>>>0){s=c[h+24>>2]|0;l=c[h+12>>2]|0;do if((l|0)==(h|0)){j=h+20|0;k=c[j>>2]|0;if(!k){u=h+16|0;v=c[u>>2]|0;if(!v){w=0;break}else{x=v;y=u}}else{x=k;y=j}j=x;k=y;while(1){u=j+20|0;v=c[u>>2]|0;if(!v){z=j+16|0;A=c[z>>2]|0;if(!A)break;else{C=A;D=z}}else{C=v;D=u}j=C;k=D}c[k>>2]=0;w=j}else{u=c[h+8>>2]|0;c[u+12>>2]=l;c[l+8>>2]=u;w=l}while(0);do if(s|0){l=c[h+28>>2]|0;u=21232+(l<<2)|0;if((h|0)==(c[u>>2]|0)){c[u>>2]=w;if(!w){c[5233]=f&~(1<<l);break}}else{l=s+16|0;c[((c[l>>2]|0)==(h|0)?l:s+20|0)>>2]=w;if(!w)break}c[w+24>>2]=s;l=c[h+16>>2]|0;if(l|0){c[w+16>>2]=l;c[l+24>>2]=w}l=c[h+20>>2]|0;if(l|0){c[w+20>>2]=l;c[l+24>>2]=w}}while(0);if(n>>>0<16){s=n+e|0;c[h+4>>2]=s|3;f=h+s+4|0;c[f>>2]=c[f>>2]|1}else{c[h+4>>2]=e|3;c[i+4>>2]=n|1;c[i+n>>2]=n;if(m|0){f=c[5237]|0;s=m>>>3;l=20968+(s<<1<<2)|0;u=1<<s;if(!(u&g)){c[5232]=u|g;E=l;F=l+8|0}else{u=l+8|0;E=c[u>>2]|0;F=u}c[F>>2]=f;c[E+12>>2]=f;c[f+8>>2]=E;c[f+12>>2]=l}c[5234]=n;c[5237]=i}o=h+8|0;Ia=b;return o|0}else G=e}else G=e}else G=e}else if(a>>>0<=4294967231){l=a+11|0;f=l&-8;u=c[5233]|0;if(u){s=0-f|0;v=l>>>8;if(v)if(f>>>0>16777215)H=31;else{l=(v+1048320|0)>>>16&8;z=v<<l;v=(z+520192|0)>>>16&4;A=z<<v;z=(A+245760|0)>>>16&2;I=14-(v|l|z)+(A<<z>>>15)|0;H=f>>>(I+7|0)&1|I<<1}else H=0;I=c[21232+(H<<2)>>2]|0;a:do if(!I){J=0;K=0;L=s;M=61}else{z=0;A=s;l=I;v=f<<((H|0)==31?0:25-(H>>>1)|0);N=0;while(1){O=(c[l+4>>2]&-8)-f|0;if(O>>>0<A>>>0)if(!O){P=l;Q=0;R=l;M=65;break a}else{S=l;T=O}else{S=z;T=A}O=c[l+20>>2]|0;l=c[l+16+(v>>>31<<2)>>2]|0;U=(O|0)==0|(O|0)==(l|0)?N:O;if(!l){J=U;K=S;L=T;M=61;break}else{z=S;A=T;v=v<<1;N=U}}}while(0);if((M|0)==61){if((J|0)==0&(K|0)==0){I=2<<H;s=(I|0-I)&u;if(!s){G=f;break}I=(s&0-s)+-1|0;s=I>>>12&16;e=I>>>s;I=e>>>5&8;h=e>>>I;e=h>>>2&4;i=h>>>e;h=i>>>1&2;n=i>>>h;i=n>>>1&1;V=0;W=c[21232+((I|s|e|h|i)+(n>>>i)<<2)>>2]|0}else{V=K;W=J}if(!W){X=V;Y=L}else{P=V;Q=L;R=W;M=65}}if((M|0)==65){i=P;n=Q;h=R;while(1){e=(c[h+4>>2]&-8)-f|0;s=e>>>0<n>>>0;I=s?e:n;e=s?h:i;s=c[h+16>>2]|0;if(!s)Z=c[h+20>>2]|0;else Z=s;if(!Z){X=e;Y=I;break}else{i=e;n=I;h=Z}}}if(((X|0)!=0?Y>>>0<((c[5234]|0)-f|0)>>>0:0)?(h=X+f|0,h>>>0>X>>>0):0){n=c[X+24>>2]|0;i=c[X+12>>2]|0;do if((i|0)==(X|0)){I=X+20|0;e=c[I>>2]|0;if(!e){s=X+16|0;g=c[s>>2]|0;if(!g){_=0;break}else{$=g;aa=s}}else{$=e;aa=I}I=$;e=aa;while(1){s=I+20|0;g=c[s>>2]|0;if(!g){m=I+16|0;N=c[m>>2]|0;if(!N)break;else{ba=N;ca=m}}else{ba=g;ca=s}I=ba;e=ca}c[e>>2]=0;_=I}else{s=c[X+8>>2]|0;c[s+12>>2]=i;c[i+8>>2]=s;_=i}while(0);do if(n){i=c[X+28>>2]|0;s=21232+(i<<2)|0;if((X|0)==(c[s>>2]|0)){c[s>>2]=_;if(!_){s=u&~(1<<i);c[5233]=s;da=s;break}}else{s=n+16|0;c[((c[s>>2]|0)==(X|0)?s:n+20|0)>>2]=_;if(!_){da=u;break}}c[_+24>>2]=n;s=c[X+16>>2]|0;if(s|0){c[_+16>>2]=s;c[s+24>>2]=_}s=c[X+20>>2]|0;if(s){c[_+20>>2]=s;c[s+24>>2]=_;da=u}else da=u}else da=u;while(0);b:do if(Y>>>0<16){u=Y+f|0;c[X+4>>2]=u|3;n=X+u+4|0;c[n>>2]=c[n>>2]|1}else{c[X+4>>2]=f|3;c[h+4>>2]=Y|1;c[h+Y>>2]=Y;n=Y>>>3;if(Y>>>0<256){u=20968+(n<<1<<2)|0;s=c[5232]|0;i=1<<n;if(!(s&i)){c[5232]=s|i;ea=u;fa=u+8|0}else{i=u+8|0;ea=c[i>>2]|0;fa=i}c[fa>>2]=h;c[ea+12>>2]=h;c[h+8>>2]=ea;c[h+12>>2]=u;break}u=Y>>>8;if(u)if(Y>>>0>16777215)ga=31;else{i=(u+1048320|0)>>>16&8;s=u<<i;u=(s+520192|0)>>>16&4;n=s<<u;s=(n+245760|0)>>>16&2;g=14-(u|i|s)+(n<<s>>>15)|0;ga=Y>>>(g+7|0)&1|g<<1}else ga=0;g=21232+(ga<<2)|0;c[h+28>>2]=ga;s=h+16|0;c[s+4>>2]=0;c[s>>2]=0;s=1<<ga;if(!(da&s)){c[5233]=da|s;c[g>>2]=h;c[h+24>>2]=g;c[h+12>>2]=h;c[h+8>>2]=h;break}s=c[g>>2]|0;c:do if((c[s+4>>2]&-8|0)==(Y|0))ha=s;else{g=Y<<((ga|0)==31?0:25-(ga>>>1)|0);n=s;while(1){ia=n+16+(g>>>31<<2)|0;i=c[ia>>2]|0;if(!i)break;if((c[i+4>>2]&-8|0)==(Y|0)){ha=i;break c}else{g=g<<1;n=i}}c[ia>>2]=h;c[h+24>>2]=n;c[h+12>>2]=h;c[h+8>>2]=h;break b}while(0);s=ha+8|0;I=c[s>>2]|0;c[I+12>>2]=h;c[s>>2]=h;c[h+8>>2]=I;c[h+12>>2]=ha;c[h+24>>2]=0}while(0);o=X+8|0;Ia=b;return o|0}else G=f}else G=f}else G=-1;while(0);X=c[5234]|0;if(X>>>0>=G>>>0){ha=X-G|0;ia=c[5237]|0;if(ha>>>0>15){Y=ia+G|0;c[5237]=Y;c[5234]=ha;c[Y+4>>2]=ha|1;c[ia+X>>2]=ha;c[ia+4>>2]=G|3}else{c[5234]=0;c[5237]=0;c[ia+4>>2]=X|3;ha=ia+X+4|0;c[ha>>2]=c[ha>>2]|1}o=ia+8|0;Ia=b;return o|0}ia=c[5235]|0;if(ia>>>0>G>>>0){ha=ia-G|0;c[5235]=ha;X=c[5238]|0;Y=X+G|0;c[5238]=Y;c[Y+4>>2]=ha|1;c[X+4>>2]=G|3;o=X+8|0;Ia=b;return o|0}if(!(c[5350]|0)){c[5352]=4096;c[5351]=4096;c[5353]=-1;c[5354]=-1;c[5355]=0;c[5343]=0;c[5350]=d&-16^1431655768;ja=4096}else ja=c[5352]|0;d=G+48|0;X=G+47|0;ha=ja+X|0;Y=0-ja|0;ja=ha&Y;if(ja>>>0<=G>>>0){o=0;Ia=b;return o|0}ga=c[5342]|0;if(ga|0?(da=c[5340]|0,ea=da+ja|0,ea>>>0<=da>>>0|ea>>>0>ga>>>0):0){o=0;Ia=b;return o|0}d:do if(!(c[5343]&4)){ga=c[5238]|0;e:do if(ga){ea=21376;while(1){da=c[ea>>2]|0;if(da>>>0<=ga>>>0?(da+(c[ea+4>>2]|0)|0)>>>0>ga>>>0:0)break;da=c[ea+8>>2]|0;if(!da){M=128;break e}else ea=da}da=ha-ia&Y;if(da>>>0<2147483647){fa=Vj(da|0)|0;if((fa|0)==((c[ea>>2]|0)+(c[ea+4>>2]|0)|0))if((fa|0)==(-1|0))ka=da;else{la=da;ma=fa;M=145;break d}else{na=fa;oa=da;M=136}}else ka=0}else M=128;while(0);do if((M|0)==128){ga=Vj(0)|0;if((ga|0)!=(-1|0)?(f=ga,da=c[5351]|0,fa=da+-1|0,_=((fa&f|0)==0?0:(fa+f&0-da)-f|0)+ja|0,f=c[5340]|0,da=_+f|0,_>>>0>G>>>0&_>>>0<2147483647):0){fa=c[5342]|0;if(fa|0?da>>>0<=f>>>0|da>>>0>fa>>>0:0){ka=0;break}fa=Vj(_|0)|0;if((fa|0)==(ga|0)){la=_;ma=ga;M=145;break d}else{na=fa;oa=_;M=136}}else ka=0}while(0);do if((M|0)==136){_=0-oa|0;if(!(d>>>0>oa>>>0&(oa>>>0<2147483647&(na|0)!=(-1|0))))if((na|0)==(-1|0)){ka=0;break}else{la=oa;ma=na;M=145;break d}fa=c[5352]|0;ga=X-oa+fa&0-fa;if(ga>>>0>=2147483647){la=oa;ma=na;M=145;break d}if((Vj(ga|0)|0)==(-1|0)){Vj(_|0)|0;ka=0;break}else{la=ga+oa|0;ma=na;M=145;break d}}while(0);c[5343]=c[5343]|4;pa=ka;M=143}else{pa=0;M=143}while(0);if(((M|0)==143?ja>>>0<2147483647:0)?(ka=Vj(ja|0)|0,ja=Vj(0)|0,na=ja-ka|0,oa=na>>>0>(G+40|0)>>>0,!((ka|0)==(-1|0)|oa^1|ka>>>0<ja>>>0&((ka|0)!=(-1|0)&(ja|0)!=(-1|0))^1)):0){la=oa?na:pa;ma=ka;M=145}if((M|0)==145){ka=(c[5340]|0)+la|0;c[5340]=ka;if(ka>>>0>(c[5341]|0)>>>0)c[5341]=ka;ka=c[5238]|0;f:do if(ka){pa=21376;while(1){qa=c[pa>>2]|0;ra=c[pa+4>>2]|0;if((ma|0)==(qa+ra|0)){M=154;break}na=c[pa+8>>2]|0;if(!na)break;else pa=na}if(((M|0)==154?(na=pa+4|0,(c[pa+12>>2]&8|0)==0):0)?ma>>>0>ka>>>0&qa>>>0<=ka>>>0:0){c[na>>2]=ra+la;na=(c[5235]|0)+la|0;oa=ka+8|0;ja=(oa&7|0)==0?0:0-oa&7;oa=ka+ja|0;X=na-ja|0;c[5238]=oa;c[5235]=X;c[oa+4>>2]=X|1;c[ka+na+4>>2]=40;c[5239]=c[5354];break}if(ma>>>0<(c[5236]|0)>>>0)c[5236]=ma;na=ma+la|0;X=21376;while(1){if((c[X>>2]|0)==(na|0)){M=162;break}oa=c[X+8>>2]|0;if(!oa)break;else X=oa}if((M|0)==162?(c[X+12>>2]&8|0)==0:0){c[X>>2]=ma;pa=X+4|0;c[pa>>2]=(c[pa>>2]|0)+la;pa=ma+8|0;oa=ma+((pa&7|0)==0?0:0-pa&7)|0;pa=na+8|0;ja=na+((pa&7|0)==0?0:0-pa&7)|0;pa=oa+G|0;d=ja-oa-G|0;c[oa+4>>2]=G|3;g:do if((ka|0)==(ja|0)){Y=(c[5235]|0)+d|0;c[5235]=Y;c[5238]=pa;c[pa+4>>2]=Y|1}else{if((c[5237]|0)==(ja|0)){Y=(c[5234]|0)+d|0;c[5234]=Y;c[5237]=pa;c[pa+4>>2]=Y|1;c[pa+Y>>2]=Y;break}Y=c[ja+4>>2]|0;if((Y&3|0)==1){ia=Y&-8;ha=Y>>>3;h:do if(Y>>>0<256){ga=c[ja+8>>2]|0;_=c[ja+12>>2]|0;if((_|0)==(ga|0)){c[5232]=c[5232]&~(1<<ha);break}else{c[ga+12>>2]=_;c[_+8>>2]=ga;break}}else{ga=c[ja+24>>2]|0;_=c[ja+12>>2]|0;do if((_|0)==(ja|0)){fa=ja+16|0;da=fa+4|0;f=c[da>>2]|0;if(!f){ca=c[fa>>2]|0;if(!ca){sa=0;break}else{ta=ca;ua=fa}}else{ta=f;ua=da}da=ta;f=ua;while(1){fa=da+20|0;ca=c[fa>>2]|0;if(!ca){ba=da+16|0;aa=c[ba>>2]|0;if(!aa)break;else{va=aa;wa=ba}}else{va=ca;wa=fa}da=va;f=wa}c[f>>2]=0;sa=da}else{fa=c[ja+8>>2]|0;c[fa+12>>2]=_;c[_+8>>2]=fa;sa=_}while(0);if(!ga)break;_=c[ja+28>>2]|0;n=21232+(_<<2)|0;do if((c[n>>2]|0)!=(ja|0)){fa=ga+16|0;c[((c[fa>>2]|0)==(ja|0)?fa:ga+20|0)>>2]=sa;if(!sa)break h}else{c[n>>2]=sa;if(sa|0)break;c[5233]=c[5233]&~(1<<_);break h}while(0);c[sa+24>>2]=ga;_=ja+16|0;n=c[_>>2]|0;if(n|0){c[sa+16>>2]=n;c[n+24>>2]=sa}n=c[_+4>>2]|0;if(!n)break;c[sa+20>>2]=n;c[n+24>>2]=sa}while(0);xa=ja+ia|0;ya=ia+d|0}else{xa=ja;ya=d}ha=xa+4|0;c[ha>>2]=c[ha>>2]&-2;c[pa+4>>2]=ya|1;c[pa+ya>>2]=ya;ha=ya>>>3;if(ya>>>0<256){Y=20968+(ha<<1<<2)|0;ea=c[5232]|0;n=1<<ha;if(!(ea&n)){c[5232]=ea|n;za=Y;Aa=Y+8|0}else{n=Y+8|0;za=c[n>>2]|0;Aa=n}c[Aa>>2]=pa;c[za+12>>2]=pa;c[pa+8>>2]=za;c[pa+12>>2]=Y;break}Y=ya>>>8;do if(!Y)Ba=0;else{if(ya>>>0>16777215){Ba=31;break}n=(Y+1048320|0)>>>16&8;ea=Y<<n;ha=(ea+520192|0)>>>16&4;_=ea<<ha;ea=(_+245760|0)>>>16&2;fa=14-(ha|n|ea)+(_<<ea>>>15)|0;Ba=ya>>>(fa+7|0)&1|fa<<1}while(0);Y=21232+(Ba<<2)|0;c[pa+28>>2]=Ba;ia=pa+16|0;c[ia+4>>2]=0;c[ia>>2]=0;ia=c[5233]|0;fa=1<<Ba;if(!(ia&fa)){c[5233]=ia|fa;c[Y>>2]=pa;c[pa+24>>2]=Y;c[pa+12>>2]=pa;c[pa+8>>2]=pa;break}fa=c[Y>>2]|0;i:do if((c[fa+4>>2]&-8|0)==(ya|0))Ca=fa;else{Y=ya<<((Ba|0)==31?0:25-(Ba>>>1)|0);ia=fa;while(1){Da=ia+16+(Y>>>31<<2)|0;ea=c[Da>>2]|0;if(!ea)break;if((c[ea+4>>2]&-8|0)==(ya|0)){Ca=ea;break i}else{Y=Y<<1;ia=ea}}c[Da>>2]=pa;c[pa+24>>2]=ia;c[pa+12>>2]=pa;c[pa+8>>2]=pa;break g}while(0);fa=Ca+8|0;Y=c[fa>>2]|0;c[Y+12>>2]=pa;c[fa>>2]=pa;c[pa+8>>2]=Y;c[pa+12>>2]=Ca;c[pa+24>>2]=0}while(0);o=oa+8|0;Ia=b;return o|0}pa=21376;while(1){d=c[pa>>2]|0;if(d>>>0<=ka>>>0?(Ea=d+(c[pa+4>>2]|0)|0,Ea>>>0>ka>>>0):0)break;pa=c[pa+8>>2]|0}pa=Ea+-47|0;oa=pa+8|0;d=pa+((oa&7|0)==0?0:0-oa&7)|0;oa=ka+16|0;pa=d>>>0<oa>>>0?ka:d;d=pa+8|0;ja=la+-40|0;na=ma+8|0;X=(na&7|0)==0?0:0-na&7;na=ma+X|0;Y=ja-X|0;c[5238]=na;c[5235]=Y;c[na+4>>2]=Y|1;c[ma+ja+4>>2]=40;c[5239]=c[5354];ja=pa+4|0;c[ja>>2]=27;c[d>>2]=c[5344];c[d+4>>2]=c[5345];c[d+8>>2]=c[5346];c[d+12>>2]=c[5347];c[5344]=ma;c[5345]=la;c[5347]=0;c[5346]=d;d=pa+24|0;do{Y=d;d=d+4|0;c[d>>2]=7}while((Y+8|0)>>>0<Ea>>>0);if((pa|0)!=(ka|0)){d=pa-ka|0;c[ja>>2]=c[ja>>2]&-2;c[ka+4>>2]=d|1;c[pa>>2]=d;Y=d>>>3;if(d>>>0<256){na=20968+(Y<<1<<2)|0;X=c[5232]|0;fa=1<<Y;if(!(X&fa)){c[5232]=X|fa;Fa=na;Ga=na+8|0}else{fa=na+8|0;Fa=c[fa>>2]|0;Ga=fa}c[Ga>>2]=ka;c[Fa+12>>2]=ka;c[ka+8>>2]=Fa;c[ka+12>>2]=na;break}na=d>>>8;if(na)if(d>>>0>16777215)Ha=31;else{fa=(na+1048320|0)>>>16&8;X=na<<fa;na=(X+520192|0)>>>16&4;Y=X<<na;X=(Y+245760|0)>>>16&2;ga=14-(na|fa|X)+(Y<<X>>>15)|0;Ha=d>>>(ga+7|0)&1|ga<<1}else Ha=0;ga=21232+(Ha<<2)|0;c[ka+28>>2]=Ha;c[ka+20>>2]=0;c[oa>>2]=0;X=c[5233]|0;Y=1<<Ha;if(!(X&Y)){c[5233]=X|Y;c[ga>>2]=ka;c[ka+24>>2]=ga;c[ka+12>>2]=ka;c[ka+8>>2]=ka;break}Y=c[ga>>2]|0;j:do if((c[Y+4>>2]&-8|0)==(d|0))Ka=Y;else{ga=d<<((Ha|0)==31?0:25-(Ha>>>1)|0);X=Y;while(1){La=X+16+(ga>>>31<<2)|0;fa=c[La>>2]|0;if(!fa)break;if((c[fa+4>>2]&-8|0)==(d|0)){Ka=fa;break j}else{ga=ga<<1;X=fa}}c[La>>2]=ka;c[ka+24>>2]=X;c[ka+12>>2]=ka;c[ka+8>>2]=ka;break f}while(0);d=Ka+8|0;Y=c[d>>2]|0;c[Y+12>>2]=ka;c[d>>2]=ka;c[ka+8>>2]=Y;c[ka+12>>2]=Ka;c[ka+24>>2]=0}}else{Y=c[5236]|0;if((Y|0)==0|ma>>>0<Y>>>0)c[5236]=ma;c[5344]=ma;c[5345]=la;c[5347]=0;c[5241]=c[5350];c[5240]=-1;c[5245]=20968;c[5244]=20968;c[5247]=20976;c[5246]=20976;c[5249]=20984;c[5248]=20984;c[5251]=20992;c[5250]=20992;c[5253]=21e3;c[5252]=21e3;c[5255]=21008;c[5254]=21008;c[5257]=21016;c[5256]=21016;c[5259]=21024;c[5258]=21024;c[5261]=21032;c[5260]=21032;c[5263]=21040;c[5262]=21040;c[5265]=21048;c[5264]=21048;c[5267]=21056;c[5266]=21056;c[5269]=21064;c[5268]=21064;c[5271]=21072;c[5270]=21072;c[5273]=21080;c[5272]=21080;c[5275]=21088;c[5274]=21088;c[5277]=21096;c[5276]=21096;c[5279]=21104;c[5278]=21104;c[5281]=21112;c[5280]=21112;c[5283]=21120;c[5282]=21120;c[5285]=21128;c[5284]=21128;c[5287]=21136;c[5286]=21136;c[5289]=21144;c[5288]=21144;c[5291]=21152;c[5290]=21152;c[5293]=21160;c[5292]=21160;c[5295]=21168;c[5294]=21168;c[5297]=21176;c[5296]=21176;c[5299]=21184;c[5298]=21184;c[5301]=21192;c[5300]=21192;c[5303]=21200;c[5302]=21200;c[5305]=21208;c[5304]=21208;c[5307]=21216;c[5306]=21216;Y=la+-40|0;d=ma+8|0;oa=(d&7|0)==0?0:0-d&7;d=ma+oa|0;pa=Y-oa|0;c[5238]=d;c[5235]=pa;c[d+4>>2]=pa|1;c[ma+Y+4>>2]=40;c[5239]=c[5354]}while(0);ma=c[5235]|0;if(ma>>>0>G>>>0){la=ma-G|0;c[5235]=la;ma=c[5238]|0;ka=ma+G|0;c[5238]=ka;c[ka+4>>2]=la|1;c[ma+4>>2]=G|3;o=ma+8|0;Ia=b;return o|0}}c[(hh()|0)>>2]=12;o=0;Ia=b;return o|0}function fi(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0;if(!a)return;b=a+-8|0;d=c[5236]|0;e=c[a+-4>>2]|0;a=e&-8;f=b+a|0;do if(!(e&1)){g=c[b>>2]|0;if(!(e&3))return;h=b+(0-g)|0;i=g+a|0;if(h>>>0<d>>>0)return;if((c[5237]|0)==(h|0)){j=f+4|0;k=c[j>>2]|0;if((k&3|0)!=3){l=h;m=i;n=h;break}c[5234]=i;c[j>>2]=k&-2;c[h+4>>2]=i|1;c[h+i>>2]=i;return}k=g>>>3;if(g>>>0<256){g=c[h+8>>2]|0;j=c[h+12>>2]|0;if((j|0)==(g|0)){c[5232]=c[5232]&~(1<<k);l=h;m=i;n=h;break}else{c[g+12>>2]=j;c[j+8>>2]=g;l=h;m=i;n=h;break}}g=c[h+24>>2]|0;j=c[h+12>>2]|0;do if((j|0)==(h|0)){k=h+16|0;o=k+4|0;p=c[o>>2]|0;if(!p){q=c[k>>2]|0;if(!q){r=0;break}else{s=q;t=k}}else{s=p;t=o}o=s;p=t;while(1){k=o+20|0;q=c[k>>2]|0;if(!q){u=o+16|0;v=c[u>>2]|0;if(!v)break;else{w=v;x=u}}else{w=q;x=k}o=w;p=x}c[p>>2]=0;r=o}else{k=c[h+8>>2]|0;c[k+12>>2]=j;c[j+8>>2]=k;r=j}while(0);if(g){j=c[h+28>>2]|0;k=21232+(j<<2)|0;if((c[k>>2]|0)==(h|0)){c[k>>2]=r;if(!r){c[5233]=c[5233]&~(1<<j);l=h;m=i;n=h;break}}else{j=g+16|0;c[((c[j>>2]|0)==(h|0)?j:g+20|0)>>2]=r;if(!r){l=h;m=i;n=h;break}}c[r+24>>2]=g;j=h+16|0;k=c[j>>2]|0;if(k|0){c[r+16>>2]=k;c[k+24>>2]=r}k=c[j+4>>2]|0;if(k){c[r+20>>2]=k;c[k+24>>2]=r;l=h;m=i;n=h}else{l=h;m=i;n=h}}else{l=h;m=i;n=h}}else{l=b;m=a;n=b}while(0);if(n>>>0>=f>>>0)return;b=f+4|0;a=c[b>>2]|0;if(!(a&1))return;if(!(a&2)){if((c[5238]|0)==(f|0)){r=(c[5235]|0)+m|0;c[5235]=r;c[5238]=l;c[l+4>>2]=r|1;if((l|0)!=(c[5237]|0))return;c[5237]=0;c[5234]=0;return}if((c[5237]|0)==(f|0)){r=(c[5234]|0)+m|0;c[5234]=r;c[5237]=n;c[l+4>>2]=r|1;c[n+r>>2]=r;return}r=(a&-8)+m|0;x=a>>>3;do if(a>>>0<256){w=c[f+8>>2]|0;t=c[f+12>>2]|0;if((t|0)==(w|0)){c[5232]=c[5232]&~(1<<x);break}else{c[w+12>>2]=t;c[t+8>>2]=w;break}}else{w=c[f+24>>2]|0;t=c[f+12>>2]|0;do if((t|0)==(f|0)){s=f+16|0;d=s+4|0;e=c[d>>2]|0;if(!e){k=c[s>>2]|0;if(!k){y=0;break}else{z=k;A=s}}else{z=e;A=d}d=z;e=A;while(1){s=d+20|0;k=c[s>>2]|0;if(!k){j=d+16|0;q=c[j>>2]|0;if(!q)break;else{B=q;C=j}}else{B=k;C=s}d=B;e=C}c[e>>2]=0;y=d}else{o=c[f+8>>2]|0;c[o+12>>2]=t;c[t+8>>2]=o;y=t}while(0);if(w|0){t=c[f+28>>2]|0;h=21232+(t<<2)|0;if((c[h>>2]|0)==(f|0)){c[h>>2]=y;if(!y){c[5233]=c[5233]&~(1<<t);break}}else{t=w+16|0;c[((c[t>>2]|0)==(f|0)?t:w+20|0)>>2]=y;if(!y)break}c[y+24>>2]=w;t=f+16|0;h=c[t>>2]|0;if(h|0){c[y+16>>2]=h;c[h+24>>2]=y}h=c[t+4>>2]|0;if(h|0){c[y+20>>2]=h;c[h+24>>2]=y}}}while(0);c[l+4>>2]=r|1;c[n+r>>2]=r;if((l|0)==(c[5237]|0)){c[5234]=r;return}else D=r}else{c[b>>2]=a&-2;c[l+4>>2]=m|1;c[n+m>>2]=m;D=m}m=D>>>3;if(D>>>0<256){n=20968+(m<<1<<2)|0;a=c[5232]|0;b=1<<m;if(!(a&b)){c[5232]=a|b;E=n;F=n+8|0}else{b=n+8|0;E=c[b>>2]|0;F=b}c[F>>2]=l;c[E+12>>2]=l;c[l+8>>2]=E;c[l+12>>2]=n;return}n=D>>>8;if(n)if(D>>>0>16777215)G=31;else{E=(n+1048320|0)>>>16&8;F=n<<E;n=(F+520192|0)>>>16&4;b=F<<n;F=(b+245760|0)>>>16&2;a=14-(n|E|F)+(b<<F>>>15)|0;G=D>>>(a+7|0)&1|a<<1}else G=0;a=21232+(G<<2)|0;c[l+28>>2]=G;c[l+20>>2]=0;c[l+16>>2]=0;F=c[5233]|0;b=1<<G;a:do if(!(F&b)){c[5233]=F|b;c[a>>2]=l;c[l+24>>2]=a;c[l+12>>2]=l;c[l+8>>2]=l}else{E=c[a>>2]|0;b:do if((c[E+4>>2]&-8|0)==(D|0))H=E;else{n=D<<((G|0)==31?0:25-(G>>>1)|0);m=E;while(1){I=m+16+(n>>>31<<2)|0;r=c[I>>2]|0;if(!r)break;if((c[r+4>>2]&-8|0)==(D|0)){H=r;break b}else{n=n<<1;m=r}}c[I>>2]=l;c[l+24>>2]=m;c[l+12>>2]=l;c[l+8>>2]=l;break a}while(0);E=H+8|0;w=c[E>>2]|0;c[w+12>>2]=l;c[E>>2]=l;c[l+8>>2]=w;c[l+12>>2]=H;c[l+24>>2]=0}while(0);l=(c[5240]|0)+-1|0;c[5240]=l;if(l|0)return;l=21384;while(1){H=c[l>>2]|0;if(!H)break;else l=H+8|0}c[5240]=-1;return}function gi(a){a=a|0;return}function hi(a){a=a|0;gi(a);oi(a);return}function ii(a){a=a|0;return 16430}function ji(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,x=0,y=0,z=0,A=0,C=0,D=0,E=0,F=0;b=Ia;Ia=Ia+16|0;if((Ia|0)>=(Ja|0))B(16);d=b;e=b+8|0;f=b+4|0;c[e>>2]=a;do if(a>>>0>=212){g=(a>>>0)/210|0;h=g*210|0;c[f>>2]=a-h;i=0;j=g;g=h;h=(ki(2592,2784,f,d)|0)-2592>>2;a:while(1){k=(c[2592+(h<<2)>>2]|0)+g|0;l=5;while(1){if(l>>>0>=47){m=6;break}n=c[2400+(l<<2)>>2]|0;o=(k>>>0)/(n>>>0)|0;if(o>>>0<n>>>0){m=107;break a}if((k|0)==(w(o,n)|0)){p=i;break}else l=l+1|0}b:do if((m|0)==6){m=0;l=211;n=i;c:while(1){o=(k>>>0)/(l>>>0)|0;do if(o>>>0>=l>>>0)if((k|0)!=(w(o,l)|0)){q=l+10|0;r=(k>>>0)/(q>>>0)|0;if(r>>>0>=q>>>0)if((k|0)!=(w(r,q)|0)){r=l+12|0;s=(k>>>0)/(r>>>0)|0;if(s>>>0>=r>>>0)if((k|0)!=(w(s,r)|0)){s=l+16|0;t=(k>>>0)/(s>>>0)|0;if(t>>>0>=s>>>0)if((k|0)!=(w(t,s)|0)){t=l+18|0;u=(k>>>0)/(t>>>0)|0;if(u>>>0>=t>>>0)if((k|0)!=(w(u,t)|0)){u=l+22|0;v=(k>>>0)/(u>>>0)|0;if(v>>>0>=u>>>0)if((k|0)!=(w(v,u)|0)){v=l+28|0;x=(k>>>0)/(v>>>0)|0;if(x>>>0>=v>>>0)if((k|0)==(w(x,v)|0)){y=v;z=9;A=n}else{x=l+30|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(w(C,x)|0)){y=x;z=9;A=n;break}x=l+36|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(w(C,x)|0)){y=x;z=9;A=n;break}x=l+40|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(w(C,x)|0)){y=x;z=9;A=n;break}x=l+42|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(w(C,x)|0)){y=x;z=9;A=n;break}x=l+46|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(w(C,x)|0)){y=x;z=9;A=n;break}x=l+52|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(w(C,x)|0)){y=x;z=9;A=n;break}x=l+58|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(w(C,x)|0)){y=x;z=9;A=n;break}x=l+60|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(w(C,x)|0)){y=x;z=9;A=n;break}x=l+66|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(w(C,x)|0)){y=x;z=9;A=n;break}x=l+70|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(w(C,x)|0)){y=x;z=9;A=n;break}x=l+72|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(w(C,x)|0)){y=x;z=9;A=n;break}x=l+78|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(w(C,x)|0)){y=x;z=9;A=n;break}x=l+82|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(w(C,x)|0)){y=x;z=9;A=n;break}x=l+88|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(w(C,x)|0)){y=x;z=9;A=n;break}x=l+96|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(w(C,x)|0)){y=x;z=9;A=n;break}x=l+100|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(w(C,x)|0)){y=x;z=9;A=n;break}x=l+102|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(w(C,x)|0)){y=x;z=9;A=n;break}x=l+106|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(w(C,x)|0)){y=x;z=9;A=n;break}x=l+108|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(w(C,x)|0)){y=x;z=9;A=n;break}x=l+112|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(w(C,x)|0)){y=x;z=9;A=n;break}x=l+120|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(w(C,x)|0)){y=x;z=9;A=n;break}x=l+126|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(w(C,x)|0)){y=x;z=9;A=n;break}x=l+130|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(w(C,x)|0)){y=x;z=9;A=n;break}x=l+136|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(w(C,x)|0)){y=x;z=9;A=n;break}x=l+138|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(w(C,x)|0)){y=x;z=9;A=n;break}x=l+142|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(w(C,x)|0)){y=x;z=9;A=n;break}x=l+148|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(w(C,x)|0)){y=x;z=9;A=n;break}x=l+150|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(w(C,x)|0)){y=x;z=9;A=n;break}x=l+156|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(w(C,x)|0)){y=x;z=9;A=n;break}x=l+162|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(w(C,x)|0)){y=x;z=9;A=n;break}x=l+166|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(w(C,x)|0)){y=x;z=9;A=n;break}x=l+168|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(w(C,x)|0)){y=x;z=9;A=n;break}x=l+172|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(w(C,x)|0)){y=x;z=9;A=n;break}x=l+178|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(w(C,x)|0)){y=x;z=9;A=n;break}x=l+180|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(w(C,x)|0)){y=x;z=9;A=n;break}x=l+186|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(w(C,x)|0)){y=x;z=9;A=n;break}x=l+190|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(w(C,x)|0)){y=x;z=9;A=n;break}x=l+192|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(w(C,x)|0)){y=x;z=9;A=n;break}x=l+196|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(w(C,x)|0)){y=x;z=9;A=n;break}x=l+198|0;C=(k>>>0)/(x>>>0)|0;if(C>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(w(C,x)|0)){y=x;z=9;A=n;break}x=l+208|0;C=(k>>>0)/(x>>>0)|0;D=C>>>0<x>>>0;E=(k|0)==(w(C,x)|0);y=D|E?x:l+210|0;z=D?1:E?9:0;A=D?k:n}else{y=v;z=1;A=k}}else{y=u;z=9;A=n}else{y=u;z=1;A=k}}else{y=t;z=9;A=n}else{y=t;z=1;A=k}}else{y=s;z=9;A=n}else{y=s;z=1;A=k}}else{y=r;z=9;A=n}else{y=r;z=1;A=k}}else{y=q;z=9;A=n}else{y=q;z=1;A=k}}else{y=l;z=9;A=n}else{y=l;z=1;A=k}while(0);switch(z&15){case 9:{p=A;break b;break}case 0:{l=y;n=A;break}default:break c}}if(!z)p=A;else{m=108;break a}}while(0);n=h+1|0;l=(n|0)==48;o=j+(l&1)|0;i=p;j=o;g=o*210|0;h=l?0:n}if((m|0)==107){c[e>>2]=k;F=k;break}else if((m|0)==108){c[e>>2]=k;F=A;break}}else F=c[(ki(2400,2592,e,d)|0)>>2]|0;while(0);Ia=b;return F|0}function ki(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0;e=c[d>>2]|0;d=a;f=b-a>>2;while(1){if(!f)break;a=(f|0)/2|0;b=d+(a<<2)|0;g=(c[b>>2]|0)>>>0<e>>>0;d=g?b+4|0:d;f=g?f+-1-a|0:a}return d|0}function li(a){a=a|0;return}function mi(a){a=a|0;var b=0,d=0;b=a+8|0;if(!((c[b>>2]|0)!=0?(d=c[b>>2]|0,c[b>>2]=d+-1,(d|0)!=0):0))Pa[c[(c[a>>2]|0)+16>>2]&255](a);return}function ni(a){a=a|0;var b=0,c=0;b=(a|0)==0?1:a;while(1){a=ei(b)|0;if(a|0){c=a;break}a=Gj()|0;if(!a){c=0;break}Oa[a&3]()}return c|0}function oi(a){a=a|0;fi(a);return}function pi(b,d){b=b|0;d=d|0;var e=0,f=0,g=0;e=Ia;Ia=Ia+16|0;if((Ia|0)>=(Ja|0))B(16);f=e;g=Yh((a[d+11>>0]|0)<0?c[d>>2]|0:d,0,f)|0;c[b>>2]=g;if((g|0)<0){g=c[(hh()|0)>>2]|0;Ki(f,16536,d);Ri(g,(a[f+11>>0]|0)<0?c[f>>2]|0:f)}else{Ia=e;return}}function qi(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0;b=Ia;Ia=Ia+16|0;if((Ia|0)>=(Ja|0))B(16);d=b;e=4;f=d;a:while(1){if(!e){g=9;break}b:while(1){h=ai(c[a>>2]|0,f,e)|0;switch(h|0){case 0:{g=5;break a;break}case -1:break;default:break b}if((c[(hh()|0)>>2]|0)!=4){g=7;break a}}e=e-h|0;f=f+h|0}if((g|0)==5)Ri(61,16566);else if((g|0)==7)Ri(c[(hh()|0)>>2]|0,16588);else if((g|0)==9){Ia=b;return c[d>>2]|0}return 0}function ri(a,b){a=a|0;b=b|0;var d=0,e=0,f=0;d=nh(b)|0;e=ni(d+13|0)|0;c[e>>2]=d;c[e+4>>2]=d;c[e+8>>2]=0;f=si(e)|0;Tj(f|0,b|0,d+1|0)|0;c[a>>2]=f;return}function si(a){a=a|0;return a+12|0}function ti(a,b){a=a|0;b=b|0;c[a>>2]=6200;ri(a+4|0,b);return}function ui(a){a=a|0;return 1}function vi(a){a=a|0;ua()}function wi(b,d){b=b|0;d=d|0;c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;if((a[d+11>>0]|0)<0)xi(b,c[d>>2]|0,c[d+4>>2]|0);else{c[b>>2]=c[d>>2];c[b+4>>2]=c[d+4>>2];c[b+8>>2]=c[d+8>>2]}return}function xi(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0;f=Ia;Ia=Ia+16|0;if((Ia|0)>=(Ja|0))B(16);g=f;if(e>>>0>4294967279)vi(b);if(e>>>0<11){a[b+11>>0]=e;h=b}else{i=e+16&-16;j=ni(i)|0;c[b>>2]=j;c[b+8>>2]=i|-2147483648;c[b+4>>2]=e;h=j}yi(h,d,e)|0;a[g>>0]=0;zi(h+e|0,g);Ia=f;return}function yi(a,b,c){a=a|0;b=b|0;c=c|0;if(c|0)Tj(a|0,b|0,c|0)|0;return a|0}function zi(b,c){b=b|0;c=c|0;a[b>>0]=a[c>>0]|0;return}function Ai(a){a=a|0;return nh(a)|0}function Bi(a,b,c){a=a|0;b=b|0;c=c|0;if(b|0)Uj(a|0,(Ci(c)|0)&255|0,b|0)|0;return a|0}function Ci(a){a=a|0;return a&255|0}function Di(b){b=b|0;if((a[b+11>>0]|0)<0)oi(c[b>>2]|0);return}function Ei(b,d,e,f,g,h,i,j){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;h=h|0;i=i|0;j=j|0;var k=0,l=0,m=0,n=0,o=0,p=0;k=Ia;Ia=Ia+16|0;if((Ia|0)>=(Ja|0))B(16);l=k;if((-18-d|0)>>>0<e>>>0)vi(b);if((a[b+11>>0]|0)<0)m=c[b>>2]|0;else m=b;if(d>>>0<2147483623){n=e+d|0;e=d<<1;o=n>>>0<e>>>0?e:n;p=o>>>0<11?11:o+16&-16}else p=-17;o=ni(p)|0;if(g|0)yi(o,m,g)|0;if(i|0)yi(o+g|0,j,i)|0;j=f-h|0;f=j-g|0;if(f|0)yi(o+g+i|0,m+g+h|0,f)|0;if((d|0)!=10)oi(m);c[b>>2]=o;c[b+8>>2]=p|-2147483648;p=j+i|0;c[b+4>>2]=p;a[l>>0]=0;zi(o+p|0,l);Ia=k;return}function Fi(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0;f=Ia;Ia=Ia+16|0;if((Ia|0)>=(Ja|0))B(16);g=f;h=b+11|0;i=a[h>>0]|0;j=i<<24>>24<0;if(j)k=c[b+4>>2]|0;else k=i&255;do if(k>>>0>=d>>>0)if(j){i=(c[b>>2]|0)+d|0;a[g>>0]=0;zi(i,g);c[b+4>>2]=d;break}else{a[g>>0]=0;zi(b+d|0,g);a[h>>0]=d;break}else Gi(b,d-k|0,e)|0;while(0);Ia=f;return}function Gi(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;f=Ia;Ia=Ia+16|0;if((Ia|0)>=(Ja|0))B(16);g=f;if(d|0){h=b+11|0;i=a[h>>0]|0;if(i<<24>>24<0){j=(c[b+8>>2]&2147483647)+-1|0;k=c[b+4>>2]|0}else{j=10;k=i&255}if((j-k|0)>>>0<d>>>0){Hi(b,j,k+d-j|0,k,k,0,0);l=a[h>>0]|0}else l=i;if(l<<24>>24<0)m=c[b>>2]|0;else m=b;Bi(m+k|0,d,e)|0;e=k+d|0;if((a[h>>0]|0)<0)c[b+4>>2]=e;else a[h>>0]=e;a[g>>0]=0;zi(m+e|0,g)}Ia=f;return b|0}function Hi(b,d,e,f,g,h,i){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;h=h|0;i=i|0;var j=0,k=0,l=0,m=0;if((-17-d|0)>>>0<e>>>0)vi(b);if((a[b+11>>0]|0)<0)j=c[b>>2]|0;else j=b;if(d>>>0<2147483623){k=e+d|0;e=d<<1;l=k>>>0<e>>>0?e:k;m=l>>>0<11?11:l+16&-16}else m=-17;l=ni(m)|0;if(g|0)yi(l,j,g)|0;k=f-h-g|0;if(k|0)yi(l+g+i|0,j+g+h|0,k)|0;if((d|0)!=10)oi(j);c[b>>2]=l;c[b+8>>2]=m|-2147483648;return}function Ii(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;f=Ia;Ia=Ia+16|0;if((Ia|0)>=(Ja|0))B(16);g=f;h=b+11|0;i=a[h>>0]|0;j=i<<24>>24<0;if(j){k=(c[b+8>>2]&2147483647)+-1|0;l=c[b+4>>2]|0}else{k=10;l=i&255}if((k-l|0)>>>0>=e>>>0){if(e|0){if(j)m=c[b>>2]|0;else m=b;yi(m+l|0,d,e)|0;j=l+e|0;if((a[h>>0]|0)<0)c[b+4>>2]=j;else a[h>>0]=j;a[g>>0]=0;zi(m+j|0,g)}}else Ei(b,k,l+e-k|0,l,l,0,e,d);Ia=f;return b|0}function Ji(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0,j=0;g=Ia;Ia=Ia+16|0;if((Ia|0)>=(Ja|0))B(16);h=g;if(f>>>0>4294967279)vi(b);if(f>>>0<11){a[b+11>>0]=e;i=b}else{j=f+16&-16;f=ni(j)|0;c[b>>2]=f;c[b+8>>2]=j|-2147483648;c[b+4>>2]=e;i=f}yi(i,d,e)|0;a[h>>0]=0;zi(i+e|0,h);Ia=g;return}function Ki(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0;c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;f=0;while(1){if((f|0)==3)break;c[b+(f<<2)>>2]=0;f=f+1|0}f=Ai(d)|0;g=e+11|0;h=a[g>>0]|0;i=h<<24>>24<0?c[e+4>>2]|0:h&255;Ji(b,d,f,i+f|0);Ii(b,(a[g>>0]|0)<0?c[e>>2]|0:e,i)|0;return}function Li(a,b){a=a|0;b=b|0;var c=0,d=0;c=Ia;Ia=Ia+16|0;if((Ia|0)>=(Ja|0))B(16);d=c;Mi(d);Ni(a,d,b);Di(d);Ia=c;return}function Mi(b){b=b|0;var d=0,e=0;c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;d=0;while(1){if((d|0)==3)break;c[b+(d<<2)>>2]=0;d=d+1|0}if((a[b+11>>0]|0)<0)e=(c[b+8>>2]&2147483647)+-1|0;else e=10;Fi(b,e,0);return}function Ni(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0;f=Ia;Ia=Ia+16|0;if((Ia|0)>=(Ja|0))B(16);g=f;h=d+11|0;i=a[h>>0]|0;if(i<<24>>24<0)j=c[d+4>>2]|0;else j=i&255;k=j;j=i;while(1){if(j<<24>>24<0)l=c[d>>2]|0;else l=d;c[g>>2]=e;m=Zh(l,k+1|0,16626,g)|0;if((m|0)>-1)if(m>>>0>k>>>0)n=m;else break;else n=k<<1|1;Fi(d,n,0);k=n;j=a[h>>0]|0}Fi(d,m,0);c[b>>2]=c[d>>2];c[b+4>>2]=c[d+4>>2];c[b+8>>2]=c[d+8>>2];b=0;while(1){if((b|0)==3)break;c[d+(b<<2)>>2]=0;b=b+1|0}Ia=f;return}function Oi(a,b,c){a=a|0;b=b|0;c=c|0;var d=0,e=0;d=Ia;Ia=Ia+16|0;if((Ia|0)>=(Ja|0))B(16);e=d;Pi(e);Qi(a,e,b,c);Di(e);Ia=d;return}function Pi(b){b=b|0;var d=0,e=0;c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;d=0;while(1){if((d|0)==3)break;c[b+(d<<2)>>2]=0;d=d+1|0}if((a[b+11>>0]|0)<0)e=(c[b+8>>2]&2147483647)+-1|0;else e=10;Fi(b,e,0);return}function Qi(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0;g=Ia;Ia=Ia+16|0;if((Ia|0)>=(Ja|0))B(16);h=g;i=d+11|0;j=a[i>>0]|0;if(j<<24>>24<0)k=c[d+4>>2]|0;else k=j&255;l=k;k=j;while(1){if(k<<24>>24<0)m=c[d>>2]|0;else m=d;j=h;c[j>>2]=e;c[j+4>>2]=f;n=Zh(m,l+1|0,16629,h)|0;if((n|0)>-1)if(n>>>0>l>>>0)o=n;else break;else o=l<<1|1;Fi(d,o,0);l=o;k=a[i>>0]|0}Fi(d,n,0);c[b>>2]=c[d>>2];c[b+4>>2]=c[d+4>>2];c[b+8>>2]=c[d+8>>2];b=0;while(1){if((b|0)==3)break;c[d+(b<<2)>>2]=0;b=b+1|0}Ia=g;return}function Ri(a,b){a=a|0;b=b|0;ua()}function Si(a){a=a|0;ua()}function Ti(){var a=0,b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0;a=Ia;Ia=Ia+48|0;if((Ia|0)>=(Ja|0))B(48);b=a+32|0;d=a+24|0;e=a+16|0;f=a;g=a+36|0;a=Ui()|0;if(a|0?(h=c[a>>2]|0,h|0):0){a=h+48|0;i=c[a>>2]|0;j=c[a+4>>2]|0;if(!((i&-256|0)==1126902528&(j|0)==1129074247)){c[d>>2]=16770;Vi(16720,d)}if((i|0)==1126902529&(j|0)==1129074247)k=c[h+44>>2]|0;else k=h+80|0;c[g>>2]=k;k=c[h>>2]|0;h=c[k+4>>2]|0;if(Na[c[(c[946]|0)+16>>2]&7](3784,k,g)|0){k=c[g>>2]|0;g=La[c[(c[k>>2]|0)+8>>2]&63](k)|0;c[f>>2]=16770;c[f+4>>2]=h;c[f+8>>2]=g;Vi(16634,f)}else{c[e>>2]=16770;c[e+4>>2]=h;Vi(16679,e)}}Vi(16758,b)}function Ui(){var a=0,b=0;a=Ia;Ia=Ia+16|0;if((Ia|0)>=(Ja|0))B(16);if(!(Fa(21424,3)|0)){b=Da(c[5357]|0)|0;Ia=a;return b|0}else Vi(16909,a);return 0}function Vi(a,b){a=a|0;b=b|0;var d=0,e=0;d=Ia;Ia=Ia+16|0;if((Ia|0)>=(Ja|0))B(16);e=d;c[e>>2]=b;b=c[1365]|0;Dh(b,a,e)|0;ci(10,b)|0;ua()}function Wi(a){a=a|0;return}function Xi(a){a=a|0;Wi(a);oi(a);return}function Yi(a){a=a|0;return}function Zi(a){a=a|0;return}function _i(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0;e=Ia;Ia=Ia+64|0;if((Ia|0)>=(Ja|0))B(64);f=e;if(!(cj(a,b,0)|0))if((b|0)!=0?(g=gj(b,3808,3792,0)|0,(g|0)!=0):0){b=f+4|0;h=b+52|0;do{c[b>>2]=0;b=b+4|0}while((b|0)<(h|0));c[f>>2]=g;c[f+8>>2]=a;c[f+12>>2]=-1;c[f+48>>2]=1;Ua[c[(c[g>>2]|0)+28>>2]&15](g,f,c[d>>2]|0,1);if((c[f+24>>2]|0)==1){c[d>>2]=c[f+16>>2];i=1}else i=0;j=i}else j=0;else j=1;Ia=e;return j|0}function $i(a,b,d,e,f,g){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;if(cj(a,c[b+8>>2]|0,g)|0)fj(0,b,d,e,f);return}function aj(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0;do if(!(cj(b,c[d+8>>2]|0,g)|0)){if(cj(b,c[d>>2]|0,g)|0){if((c[d+16>>2]|0)!=(e|0)?(h=d+20|0,(c[h>>2]|0)!=(e|0)):0){c[d+32>>2]=f;c[h>>2]=e;h=d+40|0;c[h>>2]=(c[h>>2]|0)+1;if((c[d+36>>2]|0)==1?(c[d+24>>2]|0)==2:0)a[d+54>>0]=1;c[d+44>>2]=4;break}if((f|0)==1)c[d+32>>2]=1}}else ej(0,d,e,f);while(0);return}function bj(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;if(cj(a,c[b+8>>2]|0,0)|0)dj(0,b,d,e);return}function cj(a,b,c){a=a|0;b=b|0;c=c|0;return (a|0)==(b|0)|0}function dj(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0;b=d+16|0;g=c[b>>2]|0;do if(g){if((g|0)!=(e|0)){h=d+36|0;c[h>>2]=(c[h>>2]|0)+1;c[d+24>>2]=2;a[d+54>>0]=1;break}h=d+24|0;if((c[h>>2]|0)==2)c[h>>2]=f}else{c[b>>2]=e;c[d+24>>2]=f;c[d+36>>2]=1}while(0);return}function ej(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;if((c[b+4>>2]|0)==(d|0)?(d=b+28|0,(c[d>>2]|0)!=1):0)c[d>>2]=e;return}function fj(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0;a[d+53>>0]=1;do if((c[d+4>>2]|0)==(f|0)){a[d+52>>0]=1;b=d+16|0;h=c[b>>2]|0;if(!h){c[b>>2]=e;c[d+24>>2]=g;c[d+36>>2]=1;if(!((g|0)==1?(c[d+48>>2]|0)==1:0))break;a[d+54>>0]=1;break}if((h|0)!=(e|0)){h=d+36|0;c[h>>2]=(c[h>>2]|0)+1;a[d+54>>0]=1;break}h=d+24|0;b=c[h>>2]|0;if((b|0)==2){c[h>>2]=g;i=g}else i=b;if((i|0)==1?(c[d+48>>2]|0)==1:0)a[d+54>>0]=1}while(0);return}function gj(d,e,f,g){d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0;h=Ia;Ia=Ia+64|0;if((Ia|0)>=(Ja|0))B(64);i=h;j=c[d>>2]|0;k=d+(c[j+-8>>2]|0)|0;l=c[j+-4>>2]|0;c[i>>2]=f;c[i+4>>2]=d;c[i+8>>2]=e;c[i+12>>2]=g;g=i+16|0;e=i+20|0;d=i+24|0;j=i+28|0;m=i+32|0;n=i+40|0;o=g;p=o+36|0;do{c[o>>2]=0;o=o+4|0}while((o|0)<(p|0));b[g+36>>1]=0;a[g+38>>0]=0;a:do if(cj(l,f,0)|0){c[i+48>>2]=1;Wa[c[(c[l>>2]|0)+20>>2]&3](l,i,k,k,1,0);q=(c[d>>2]|0)==1?k:0}else{Va[c[(c[l>>2]|0)+24>>2]&7](l,i,k,1,0);switch(c[i+36>>2]|0){case 0:{q=(c[n>>2]|0)==1&(c[j>>2]|0)==1&(c[m>>2]|0)==1?c[e>>2]|0:0;break a;break}case 1:break;default:{q=0;break a}}if((c[d>>2]|0)!=1?!((c[n>>2]|0)==0&(c[j>>2]|0)==1&(c[m>>2]|0)==1):0){q=0;break}q=c[g>>2]|0}while(0);Ia=h;return q|0}function hj(a){a=a|0;Wi(a);oi(a);return}function ij(a,b,d,e,f,g){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0;if(cj(a,c[b+8>>2]|0,g)|0)fj(0,b,d,e,f);else{h=c[a+8>>2]|0;Wa[c[(c[h>>2]|0)+20>>2]&3](h,b,d,e,f,g)}return}function jj(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0;do if(!(cj(b,c[d+8>>2]|0,g)|0)){if(!(cj(b,c[d>>2]|0,g)|0)){h=c[b+8>>2]|0;Va[c[(c[h>>2]|0)+24>>2]&7](h,d,e,f,g);break}if((c[d+16>>2]|0)!=(e|0)?(h=d+20|0,(c[h>>2]|0)!=(e|0)):0){c[d+32>>2]=f;i=d+44|0;if((c[i>>2]|0)==4)break;j=d+52|0;a[j>>0]=0;k=d+53|0;a[k>>0]=0;l=c[b+8>>2]|0;Wa[c[(c[l>>2]|0)+20>>2]&3](l,d,e,e,1,g);if(a[k>>0]|0)if(!(a[j>>0]|0)){m=1;n=11}else n=15;else{m=0;n=11}do if((n|0)==11){c[h>>2]=e;j=d+40|0;c[j>>2]=(c[j>>2]|0)+1;if((c[d+36>>2]|0)==1?(c[d+24>>2]|0)==2:0){a[d+54>>0]=1;if(m){n=15;break}else{o=4;break}}if(m)n=15;else o=4}while(0);if((n|0)==15)o=3;c[i>>2]=o;break}if((f|0)==1)c[d+32>>2]=1}else ej(0,d,e,f);while(0);return}function kj(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0;if(cj(a,c[b+8>>2]|0,0)|0)dj(0,b,d,e);else{f=c[a+8>>2]|0;Ua[c[(c[f>>2]|0)+28>>2]&15](f,b,d,e)}return}function lj(a){a=a|0;return}function mj(){var a=0;a=Ia;Ia=Ia+16|0;if((Ia|0)>=(Ja|0))B(16);if(!(Ea(21428,128)|0)){Ia=a;return}else Vi(16958,a)}function nj(a){a=a|0;var b=0;b=Ia;Ia=Ia+16|0;if((Ia|0)>=(Ja|0))B(16);fi(a);if(!(Ga(c[5357]|0,0)|0)){Ia=b;return}else Vi(17008,b)}function oj(){var a=0,b=0;a=Ui()|0;if((a|0?(b=c[a>>2]|0,b|0):0)?(a=b+48|0,(c[a>>2]&-256|0)==1126902528?(c[a+4>>2]|0)==1129074247:0):0)pj(c[b+12>>2]|0);pj(qj()|0)}function pj(a){a=a|0;var b=0;b=Ia;Ia=Ia+16|0;if((Ia|0)>=(Ja|0))B(16);Oa[a&3]();Vi(17061,b)}function qj(){var a=0;a=c[1527]|0;c[1527]=a+0;return a|0}function rj(a){a=a|0;return}function sj(a){a=a|0;c[a>>2]=6200;wj(a+4|0);return}function tj(a){a=a|0;sj(a);oi(a);return}function uj(a){a=a|0;return vj(a+4|0)|0}function vj(a){a=a|0;return c[a>>2]|0}function wj(a){a=a|0;var b=0,d=0;if(ui(a)|0?(b=xj(c[a>>2]|0)|0,a=b+8|0,d=c[a>>2]|0,c[a>>2]=d+-1,(d+-1|0)<0):0)oi(b);return}function xj(a){a=a|0;return a+-12|0}function yj(a){a=a|0;sj(a);oi(a);return}function zj(a){a=a|0;Wi(a);oi(a);return}function Aj(b,d,e,f,g,h){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;h=h|0;var i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0;if(cj(b,c[d+8>>2]|0,h)|0)fj(0,d,e,f,g);else{i=d+52|0;j=a[i>>0]|0;k=d+53|0;l=a[k>>0]|0;m=c[b+12>>2]|0;n=b+16+(m<<3)|0;a[i>>0]=0;a[k>>0]=0;Ej(b+16|0,d,e,f,g,h);a:do if((m|0)>1){o=d+24|0;p=b+8|0;q=d+54|0;r=b+24|0;do{if(a[q>>0]|0)break a;if(!(a[i>>0]|0)){if(a[k>>0]|0?(c[p>>2]&1|0)==0:0)break a}else{if((c[o>>2]|0)==1)break a;if(!(c[p>>2]&2))break a}a[i>>0]=0;a[k>>0]=0;Ej(r,d,e,f,g,h);r=r+8|0}while(r>>>0<n>>>0)}while(0);a[i>>0]=j;a[k>>0]=l}return}function Bj(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0;a:do if(!(cj(b,c[d+8>>2]|0,g)|0)){if(!(cj(b,c[d>>2]|0,g)|0)){h=c[b+12>>2]|0;i=b+16+(h<<3)|0;Fj(b+16|0,d,e,f,g);j=b+24|0;if((h|0)<=1)break;h=c[b+8>>2]|0;if((h&2|0)==0?(k=d+36|0,(c[k>>2]|0)!=1):0){if(!(h&1)){h=d+54|0;l=j;while(1){if(a[h>>0]|0)break a;if((c[k>>2]|0)==1)break a;Fj(l,d,e,f,g);l=l+8|0;if(l>>>0>=i>>>0)break a}}l=d+24|0;h=d+54|0;m=j;while(1){if(a[h>>0]|0)break a;if((c[k>>2]|0)==1?(c[l>>2]|0)==1:0)break a;Fj(m,d,e,f,g);m=m+8|0;if(m>>>0>=i>>>0)break a}}m=d+54|0;l=j;while(1){if(a[m>>0]|0)break a;Fj(l,d,e,f,g);l=l+8|0;if(l>>>0>=i>>>0)break a}}if((c[d+16>>2]|0)!=(e|0)?(i=d+20|0,(c[i>>2]|0)!=(e|0)):0){c[d+32>>2]=f;l=d+44|0;if((c[l>>2]|0)==4)break;m=b+16+(c[b+12>>2]<<3)|0;j=d+52|0;k=d+53|0;h=d+54|0;n=b+8|0;o=d+24|0;p=0;q=b+16|0;r=0;b:while(1){if(q>>>0>=m>>>0){s=p;t=18;break}a[j>>0]=0;a[k>>0]=0;Ej(q,d,e,e,1,g);if(a[h>>0]|0){s=p;t=18;break}do if(a[k>>0]|0){if(!(a[j>>0]|0))if(!(c[n>>2]&1)){s=1;t=18;break b}else{u=1;v=r;break}if((c[o>>2]|0)==1){t=23;break b}if(!(c[n>>2]&2)){t=23;break b}else{u=1;v=1}}else{u=p;v=r}while(0);p=u;q=q+8|0;r=v}do if((t|0)==18){if((!r?(c[i>>2]=e,q=d+40|0,c[q>>2]=(c[q>>2]|0)+1,(c[d+36>>2]|0)==1):0)?(c[o>>2]|0)==2:0){a[h>>0]=1;if(s){t=23;break}else{w=4;break}}if(s)t=23;else w=4}while(0);if((t|0)==23)w=3;c[l>>2]=w;break}if((f|0)==1)c[d+32>>2]=1}else ej(0,d,e,f);while(0);return}function Cj(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0;a:do if(!(cj(b,c[d+8>>2]|0,0)|0)){g=c[b+12>>2]|0;h=b+16+(g<<3)|0;Dj(b+16|0,d,e,f);if((g|0)>1){g=d+54|0;i=b+24|0;do{Dj(i,d,e,f);if(a[g>>0]|0)break a;i=i+8|0}while(i>>>0<h>>>0)}}else dj(0,d,e,f);while(0);return}function Dj(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0;f=c[a+4>>2]|0;g=f>>8;if(!(f&1))h=g;else h=c[(c[d>>2]|0)+g>>2]|0;g=c[a>>2]|0;Ua[c[(c[g>>2]|0)+28>>2]&15](g,b,d+h|0,(f&2|0)==0?2:e);return}function Ej(a,b,d,e,f,g){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0;h=c[a+4>>2]|0;i=h>>8;if(!(h&1))j=i;else j=c[(c[e>>2]|0)+i>>2]|0;i=c[a>>2]|0;Wa[c[(c[i>>2]|0)+20>>2]&3](i,b,d,e+j|0,(h&2|0)==0?2:f,g);return}function Fj(a,b,d,e,f){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0;g=c[a+4>>2]|0;h=g>>8;if(!(g&1))i=h;else i=c[(c[d>>2]|0)+h>>2]|0;h=c[a>>2]|0;Va[c[(c[h>>2]|0)+24>>2]&7](h,b,d+i|0,(g&2|0)==0?2:e,f);return}function Gj(){var a=0;a=c[5358]|0;c[5358]=a+0;return a|0}function Hj(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0;e=Ia;Ia=Ia+16|0;if((Ia|0)>=(Ja|0))B(16);f=e;c[f>>2]=c[d>>2];g=Na[c[(c[a>>2]|0)+16>>2]&7](a,b,f)|0;if(g)c[d>>2]=c[f>>2];Ia=e;return g&1|0}function Ij(a){a=a|0;var b=0;if(!a)b=0;else b=(gj(a,3808,3896,0)|0)!=0&1;return b|0}function Jj(a,b){a=a|0;b=b|0;var c=0,d=0,e=0,f=0;c=a&65535;d=b&65535;e=w(d,c)|0;f=a>>>16;a=(e>>>16)+(w(d,f)|0)|0;d=b>>>16;b=w(d,c)|0;return (z((a>>>16)+(w(d,f)|0)+(((a&65535)+b|0)>>>16)|0),a+b<<16|e&65535|0)|0}function Kj(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0,f=0;e=a;a=c;c=Jj(e,a)|0;f=A()|0;return (z((w(b,a)|0)+(w(d,e)|0)+f|f&0|0),c|0|0)|0}function Lj(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0;e=a+c>>>0;return (z(b+d+(e>>>0<a>>>0|0)>>>0|0),e|0)|0}function Mj(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0;e=b-d>>>0;e=b-d-(c>>>0>a>>>0|0)>>>0;return (z(e|0),a-c>>>0|0)|0}function Nj(a){a=a|0;return (a?31-(x(a^a-1)|0)|0:32)|0}function Oj(a,b,d,e,f){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,y=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0;g=a;h=b;i=h;j=d;k=e;l=k;if(!i){m=(f|0)!=0;if(!l){if(m){c[f>>2]=(g>>>0)%(j>>>0);c[f+4>>2]=0}n=0;o=(g>>>0)/(j>>>0)>>>0;return (z(n|0),o)|0}else{if(!m){n=0;o=0;return (z(n|0),o)|0}c[f>>2]=a|0;c[f+4>>2]=b&0;n=0;o=0;return (z(n|0),o)|0}}m=(l|0)==0;do if(j){if(!m){p=(x(l|0)|0)-(x(i|0)|0)|0;if(p>>>0<=31){q=p+1|0;r=31-p|0;s=p-31>>31;t=q;u=g>>>(q>>>0)&s|i<<r;v=i>>>(q>>>0)&s;w=0;y=g<<r;break}if(!f){n=0;o=0;return (z(n|0),o)|0}c[f>>2]=a|0;c[f+4>>2]=h|b&0;n=0;o=0;return (z(n|0),o)|0}r=j-1|0;if(r&j|0){s=(x(j|0)|0)+33-(x(i|0)|0)|0;q=64-s|0;p=32-s|0;B=p>>31;C=s-32|0;D=C>>31;t=s;u=p-1>>31&i>>>(C>>>0)|(i<<p|g>>>(s>>>0))&D;v=D&i>>>(s>>>0);w=g<<q&B;y=(i<<q|g>>>(C>>>0))&B|g<<p&s-33>>31;break}if(f|0){c[f>>2]=r&g;c[f+4>>2]=0}if((j|0)==1){n=h|b&0;o=a|0|0;return (z(n|0),o)|0}else{r=Nj(j|0)|0;n=i>>>(r>>>0)|0;o=i<<32-r|g>>>(r>>>0)|0;return (z(n|0),o)|0}}else{if(m){if(f|0){c[f>>2]=(i>>>0)%(j>>>0);c[f+4>>2]=0}n=0;o=(i>>>0)/(j>>>0)>>>0;return (z(n|0),o)|0}if(!g){if(f|0){c[f>>2]=0;c[f+4>>2]=(i>>>0)%(l>>>0)}n=0;o=(i>>>0)/(l>>>0)>>>0;return (z(n|0),o)|0}r=l-1|0;if(!(r&l)){if(f|0){c[f>>2]=a|0;c[f+4>>2]=r&i|b&0}n=0;o=i>>>((Nj(l|0)|0)>>>0);return (z(n|0),o)|0}r=(x(l|0)|0)-(x(i|0)|0)|0;if(r>>>0<=30){s=r+1|0;p=31-r|0;t=s;u=i<<p|g>>>(s>>>0);v=i>>>(s>>>0);w=0;y=g<<p;break}if(!f){n=0;o=0;return (z(n|0),o)|0}c[f>>2]=a|0;c[f+4>>2]=h|b&0;n=0;o=0;return (z(n|0),o)|0}while(0);if(!t){E=y;F=w;G=v;H=u;I=0;J=0}else{b=d|0|0;d=k|e&0;e=Lj(b|0,d|0,-1,-1)|0;k=A()|0;h=y;y=w;w=v;v=u;u=t;t=0;do{a=h;h=y>>>31|h<<1;y=t|y<<1;g=v<<1|a>>>31|0;a=v>>>31|w<<1|0;Mj(e|0,k|0,g|0,a|0)|0;i=A()|0;l=i>>31|((i|0)<0?-1:0)<<1;t=l&1;v=Mj(g|0,a|0,l&b|0,(((i|0)<0?-1:0)>>31|((i|0)<0?-1:0)<<1)&d|0)|0;w=A()|0;u=u-1|0}while((u|0)!=0);E=h;F=y;G=w;H=v;I=0;J=t}t=F;F=0;if(f|0){c[f>>2]=H;c[f+4>>2]=G}n=(t|0)>>>31|(E|F)<<1|(F<<1|t>>>31)&0|I;o=(t<<1|0>>>31)&-2|J;return (z(n|0),o)|0}function Pj(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;return Oj(a,b,c,d,0)|0}function Qj(a,b,c){a=a|0;b=b|0;c=c|0;if((c|0)<32){z(b>>>c|0);return a>>>c|(b&(1<<c)-1)<<32-c}z(0);return b>>>c-32|0}function Rj(a,b,c){a=a|0;b=b|0;c=c|0;if((c|0)<32){z(b<<c|(a&(1<<c)-1<<32-c)>>>32-c|0);return a<<c}z(a<<c-32|0);return 0}function Sj(a){a=a|0;return (a&255)<<24|(a>>8&255)<<16|(a>>16&255)<<8|a>>>24|0}function Tj(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0;if((e|0)>=8192){xa(b|0,d|0,e|0)|0;return b|0}f=b|0;g=b+e|0;if((b&3)==(d&3)){while(b&3){if(!e)return f|0;a[b>>0]=a[d>>0]|0;b=b+1|0;d=d+1|0;e=e-1|0}h=g&-4|0;e=h-64|0;while((b|0)<=(e|0)){c[b>>2]=c[d>>2];c[b+4>>2]=c[d+4>>2];c[b+8>>2]=c[d+8>>2];c[b+12>>2]=c[d+12>>2];c[b+16>>2]=c[d+16>>2];c[b+20>>2]=c[d+20>>2];c[b+24>>2]=c[d+24>>2];c[b+28>>2]=c[d+28>>2];c[b+32>>2]=c[d+32>>2];c[b+36>>2]=c[d+36>>2];c[b+40>>2]=c[d+40>>2];c[b+44>>2]=c[d+44>>2];c[b+48>>2]=c[d+48>>2];c[b+52>>2]=c[d+52>>2];c[b+56>>2]=c[d+56>>2];c[b+60>>2]=c[d+60>>2];b=b+64|0;d=d+64|0}while((b|0)<(h|0)){c[b>>2]=c[d>>2];b=b+4|0;d=d+4|0}}else{h=g-4|0;while((b|0)<(h|0)){a[b>>0]=a[d>>0]|0;a[b+1>>0]=a[d+1>>0]|0;a[b+2>>0]=a[d+2>>0]|0;a[b+3>>0]=a[d+3>>0]|0;b=b+4|0;d=d+4|0}}while((b|0)<(g|0)){a[b>>0]=a[d>>0]|0;b=b+1|0;d=d+1|0}return f|0}function Uj(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0;f=b+e|0;d=d&255;if((e|0)>=67){while(b&3){a[b>>0]=d;b=b+1|0}g=f&-4|0;h=d|d<<8|d<<16|d<<24;i=g-64|0;while((b|0)<=(i|0)){c[b>>2]=h;c[b+4>>2]=h;c[b+8>>2]=h;c[b+12>>2]=h;c[b+16>>2]=h;c[b+20>>2]=h;c[b+24>>2]=h;c[b+28>>2]=h;c[b+32>>2]=h;c[b+36>>2]=h;c[b+40>>2]=h;c[b+44>>2]=h;c[b+48>>2]=h;c[b+52>>2]=h;c[b+56>>2]=h;c[b+60>>2]=h;b=b+64|0}while((b|0)<(g|0)){c[b>>2]=h;b=b+4|0}}while((b|0)<(f|0)){a[b>>0]=d;b=b+1|0}return f-e|0}function Vj(a){a=a|0;var b=0,d=0;b=c[i>>2]|0;d=b+a|0;if((a|0)>0&(d|0)<(b|0)|(d|0)<0){Ha(d|0)|0;la(12);return -1}if((d|0)>(va()|0)){if(!(ya(d|0)|0)){la(12);return -1}}else c[i>>2]=d;return b|0}function Wj(a,b){a=a|0;b=b|0;return La[a&63](b|0)|0}function Xj(a,b,c){a=a|0;b=b|0;c=c|0;return Ma[a&63](b|0,c|0)|0}function Yj(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;return Na[a&7](b|0,c|0,d|0)|0}function Zj(a){a=a|0;Oa[a&3]()}function _j(a,b){a=a|0;b=b|0;Pa[a&255](b|0)}function $j(a,b,c,d){a=a|0;b=b|0;c=+c;d=d|0;Qa[a&1](b|0,+c,d|0)}function ak(a,b,c){a=a|0;b=b|0;c=c|0;Ra[a&31](b|0,c|0)}function bk(a,b,c,d){a=a|0;b=b|0;c=c|0;d=+d;Sa[a&3](b|0,c|0,+d)}function ck(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;Ta[a&3](b|0,c|0,d|0)}function dk(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;Ua[a&15](b|0,c|0,d|0,e|0)}function ek(a,b,c,d,e,f){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;f=f|0;Va[a&7](b|0,c|0,d|0,e|0,f|0)}function fk(a,b,c,d,e,f,g){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;f=f|0;g=g|0;Wa[a&3](b|0,c|0,d|0,e|0,f|0,g|0)}function gk(a){a=a|0;C(0);return 0}function hk(a){a=a|0;C(45);return 0}function ik(a){a=a|0;C(46);return 0}function jk(a){a=a|0;C(47);return 0}function kk(a){a=a|0;C(48);return 0}function lk(a){a=a|0;C(49);return 0}function mk(a){a=a|0;C(50);return 0}function nk(a){a=a|0;C(51);return 0}function ok(a){a=a|0;C(52);return 0}function pk(a){a=a|0;C(53);return 0}function qk(a){a=a|0;C(54);return 0}function rk(a){a=a|0;C(55);return 0}function sk(a){a=a|0;C(56);return 0}function tk(a){a=a|0;C(57);return 0}function uk(a){a=a|0;C(58);return 0}function vk(a){a=a|0;C(59);return 0}function wk(a){a=a|0;C(60);return 0}function xk(a){a=a|0;C(61);return 0}function yk(a){a=a|0;C(62);return 0}function zk(a){a=a|0;C(63);return 0}function Ak(a,b){a=a|0;b=b|0;D(0);return 0}function Bk(a,b){a=a|0;b=b|0;D(33);return 0}function Ck(a,b){a=a|0;b=b|0;D(34);return 0}function Dk(a,b){a=a|0;b=b|0;D(35);return 0}function Ek(a,b){a=a|0;b=b|0;D(36);return 0}function Fk(a,b){a=a|0;b=b|0;D(37);return 0}function Gk(a,b){a=a|0;b=b|0;D(38);return 0}function Hk(a,b){a=a|0;b=b|0;D(39);return 0}function Ik(a,b){a=a|0;b=b|0;D(40);return 0}function Jk(a,b){a=a|0;b=b|0;D(41);return 0}function Kk(a,b){a=a|0;b=b|0;D(42);return 0}function Lk(a,b){a=a|0;b=b|0;D(43);return 0}function Mk(a,b){a=a|0;b=b|0;D(44);return 0}function Nk(a,b){a=a|0;b=b|0;D(45);return 0}function Ok(a,b){a=a|0;b=b|0;D(46);return 0}function Pk(a,b){a=a|0;b=b|0;D(47);return 0}function Qk(a,b){a=a|0;b=b|0;D(48);return 0}function Rk(a,b){a=a|0;b=b|0;D(49);return 0}function Sk(a,b){a=a|0;b=b|0;D(50);return 0}function Tk(a,b){a=a|0;b=b|0;D(51);return 0}function Uk(a,b){a=a|0;b=b|0;D(52);return 0}function Vk(a,b){a=a|0;b=b|0;D(53);return 0}function Wk(a,b){a=a|0;b=b|0;D(54);return 0}function Xk(a,b){a=a|0;b=b|0;D(55);return 0}function Yk(a,b){a=a|0;b=b|0;D(56);return 0}function Zk(a,b){a=a|0;b=b|0;D(57);return 0}function _k(a,b){a=a|0;b=b|0;D(58);return 0}function $k(a,b){a=a|0;b=b|0;D(59);return 0}function al(a,b){a=a|0;b=b|0;D(60);return 0}function bl(a,b){a=a|0;b=b|0;D(61);return 0}function cl(a,b){a=a|0;b=b|0;D(62);return 0}function dl(a,b){a=a|0;b=b|0;D(63);return 0}function el(a,b,c){a=a|0;b=b|0;c=c|0;E(0);return 0}function fl(a,b,c){a=a|0;b=b|0;c=c|0;E(6);return 0}function gl(a,b,c){a=a|0;b=b|0;c=c|0;E(7);return 0}function hl(){F(0)}function il(a){a=a|0;G(0)}function jl(a){a=a|0;G(129)}function kl(a){a=a|0;G(130)}function ll(a){a=a|0;G(131)}function ml(a){a=a|0;G(132)}function nl(a){a=a|0;G(133)}function ol(a){a=a|0;G(134)}function pl(a){a=a|0;G(135)}function ql(a){a=a|0;G(136)}function rl(a){a=a|0;G(137)}function sl(a){a=a|0;G(138)}function tl(a){a=a|0;G(139)}function ul(a){a=a|0;G(140)}function vl(a){a=a|0;G(141)}function wl(a){a=a|0;G(142)}function xl(a){a=a|0;G(143)}function yl(a){a=a|0;G(144)}function zl(a){a=a|0;G(145)}function Al(a){a=a|0;G(146)}function Bl(a){a=a|0;G(147)}function Cl(a){a=a|0;G(148)}function Dl(a){a=a|0;G(149)}function El(a){a=a|0;G(150)}function Fl(a){a=a|0;G(151)}function Gl(a){a=a|0;G(152)}function Hl(a){a=a|0;G(153)}function Il(a){a=a|0;G(154)}function Jl(a){a=a|0;G(155)}function Kl(a){a=a|0;G(156)}function Ll(a){a=a|0;G(157)}function Ml(a){a=a|0;G(158)}function Nl(a){a=a|0;G(159)}function Ol(a){a=a|0;G(160)}function Pl(a){a=a|0;G(161)}function Ql(a){a=a|0;G(162)}function Rl(a){a=a|0;G(163)}function Sl(a){a=a|0;G(164)}function Tl(a){a=a|0;G(165)}function Ul(a){a=a|0;G(166)}function Vl(a){a=a|0;G(167)}function Wl(a){a=a|0;G(168)}function Xl(a){a=a|0;G(169)}function Yl(a){a=a|0;G(170)}function Zl(a){a=a|0;G(171)}function _l(a){a=a|0;G(172)}function $l(a){a=a|0;G(173)}function am(a){a=a|0;G(174)}function bm(a){a=a|0;G(175)}function cm(a){a=a|0;G(176)}function dm(a){a=a|0;G(177)}function em(a){a=a|0;G(178)}function fm(a){a=a|0;G(179)}function gm(a){a=a|0;G(180)}function hm(a){a=a|0;G(181)}function im(a){a=a|0;G(182)}function jm(a){a=a|0;G(183)}function km(a){a=a|0;G(184)}function lm(a){a=a|0;G(185)}function mm(a){a=a|0;G(186)}function nm(a){a=a|0;G(187)}function om(a){a=a|0;G(188)}function pm(a){a=a|0;G(189)}function qm(a){a=a|0;G(190)}function rm(a){a=a|0;G(191)}function sm(a){a=a|0;G(192)}function tm(a){a=a|0;G(193)}function um(a){a=a|0;G(194)}function vm(a){a=a|0;G(195)}function wm(a){a=a|0;G(196)}function xm(a){a=a|0;G(197)}function ym(a){a=a|0;G(198)}function zm(a){a=a|0;G(199)}function Am(a){a=a|0;G(200)}function Bm(a){a=a|0;G(201)}function Cm(a){a=a|0;G(202)}function Dm(a){a=a|0;G(203)}function Em(a){a=a|0;G(204)}function Fm(a){a=a|0;G(205)}function Gm(a){a=a|0;G(206)}function Hm(a){a=a|0;G(207)}function Im(a){a=a|0;G(208)}function Jm(a){a=a|0;G(209)}function Km(a){a=a|0;G(210)}function Lm(a){a=a|0;G(211)}function Mm(a){a=a|0;G(212)}function Nm(a){a=a|0;G(213)}function Om(a){a=a|0;G(214)}function Pm(a){a=a|0;G(215)}function Qm(a){a=a|0;G(216)}function Rm(a){a=a|0;G(217)}function Sm(a){a=a|0;G(218)}function Tm(a){a=a|0;G(219)}function Um(a){a=a|0;G(220)}function Vm(a){a=a|0;G(221)}function Wm(a){a=a|0;G(222)}function Xm(a){a=a|0;G(223)}function Ym(a){a=a|0;G(224)}function Zm(a){a=a|0;G(225)}function _m(a){a=a|0;G(226)}function $m(a){a=a|0;G(227)}function an(a){a=a|0;G(228)}function bn(a){a=a|0;G(229)}function cn(a){a=a|0;G(230)}function dn(a){a=a|0;G(231)}function en(a){a=a|0;G(232)}function fn(a){a=a|0;G(233)}function gn(a){a=a|0;G(234)}function hn(a){a=a|0;G(235)}function jn(a){a=a|0;G(236)}function kn(a){a=a|0;G(237)}function ln(a){a=a|0;G(238)}function mn(a){a=a|0;G(239)}function nn(a){a=a|0;G(240)}function on(a){a=a|0;G(241)}function pn(a){a=a|0;G(242)}function qn(a){a=a|0;G(243)}function rn(a){a=a|0;G(244)}function sn(a){a=a|0;G(245)}function tn(a){a=a|0;G(246)}function un(a){a=a|0;G(247)}function vn(a){a=a|0;G(248)}function wn(a){a=a|0;G(249)}function xn(a){a=a|0;G(250)}function yn(a){a=a|0;G(251)}function zn(a){a=a|0;G(252)}function An(a){a=a|0;G(253)}function Bn(a){a=a|0;G(254)}function Cn(a){a=a|0;G(255)}function Dn(a,b,c){a=a|0;b=+b;c=c|0;H(0)}function En(a,b){a=a|0;b=b|0;I(0)}function Fn(a,b){a=a|0;b=b|0;I(26)}function Gn(a,b){a=a|0;b=b|0;I(27)}function Hn(a,b){a=a|0;b=b|0;I(28)}function In(a,b){a=a|0;b=b|0;I(29)}function Jn(a,b){a=a|0;b=b|0;I(30)}function Kn(a,b){a=a|0;b=b|0;I(31)}function Ln(a,b,c){a=a|0;b=b|0;c=+c;J(0)}function Mn(a,b,c){a=a|0;b=b|0;c=c|0;K(0)}function Nn(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;L(0)}function On(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;M(0)}function Pn(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;M(7)}function Qn(a,b,c,d,e,f){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;f=f|0;N(0)}

// EMSCRIPTEN_END_FUNCS
var La=[gk,hc,nc,rc,xc,Ac,Gc,Ic,Oc,$c,dd,fd,qd,wd,Kd,Qd,se,ye,De,Je,Re,Ve,Xe,af,gf,lf,rf,tf,zf,Bf,Hf,Mf,Sf,Vf,$f,fg,jg,lg,og,ug,Qg,Wg,dh,ii,uj,hk,ik,jk,kk,lk,mk,nk,ok,pk,qk,rk,sk,tk,uk,vk,wk,xk,yk,zk];var Ma=[Ak,Cb,Kb,Rb,bc,mc,wc,Fc,Nc,Yc,ed,md,vd,Gd,Pd,Xd,de,ie,xe,Ie,We,ff,qf,yf,Gf,Rf,_f,kg,tg,Ag,Gg,Mg,Vg,Bk,Ck,Dk,Ek,Fk,Gk,Hk,Ik,Jk,Kk,Lk,Mk,Nk,Ok,Pk,Qk,Rk,Sk,Tk,Uk,Vk,Wk,Xk,Yk,Zk,_k,$k,al,bl,cl,dl];var Na=[el,eh,fh,jh,$h,_i,fl,gl];var Oa=[hl,Ti,cb,mj];var Pa=[il,li,Ab,Bb,Db,Ib,Jb,Lb,Pb,Qb,Sb,$b,ac,cc,fc,gc,jc,kc,yc,qc,tc,uc,vc,zc,Cc,Dc,Ec,oc,Hc,Kc,Lc,Wc,Xc,Zc,dg,_c,bd,cd,kd,ld,nd,xd,pd,sd,td,Ed,Fd,Hd,Id,Jd,Md,Nd,Vd,Wd,Yd,be,ce,ee,ge,he,je,qe,re,ue,ve,we,Be,Ce,Fe,Ge,He,Qe,Te,Ue,$e,cf,df,kf,nf,of,pf,sf,vf,wf,xf,Af,Df,Ef,Kf,Lf,Of,Pf,Qf,Tf,Uf,Xf,Yf,Zf,eg,hg,ig,ng,qg,rg,yg,zg,Bg,Eg,Fg,Hg,Kg,Lg,Ng,Pg,Sg,Tg,Ug,gi,hi,Wi,Xi,Yi,Zi,hj,sj,tj,yj,zj,nj,jl,kl,ll,ml,nl,ol,pl,ql,rl,sl,tl,ul,vl,wl,xl,yl,zl,Al,Bl,Cl,Dl,El,Fl,Gl,Hl,Il,Jl,Kl,Ll,Ml,Nl,Ol,Pl,Ql,Rl,Sl,Tl,Ul,Vl,Wl,Xl,Yl,Zl,_l,$l,am,bm,cm,dm,em,fm,gm,hm,im,jm,km,lm,mm,nm,om,pm,qm,rm,sm,tm,um,vm,wm,xm,ym,zm,Am,Bm,Cm,Dm,Em,Fm,Gm,Hm,Im,Jm,Km,Lm,Mm,Nm,Om,Pm,Qm,Rm,Sm,Tm,Um,Vm,Wm,Xm,Ym,Zm,_m,$m,an,bn,cn,dn,en,fn,gn,hn,jn,kn,ln,mn,nn,on,pn,qn,rn,sn,tn,un,vn,wn,xn,yn,zn,An,Bn,Cn];var Qa=[Dn,ob];var Ra=[En,pb,qb,ic,lc,sc,Bc,Jc,Mc,ad,rd,Ld,Od,te,Ee,Se,bf,mf,uf,Cf,Ff,Nf,Wf,gg,pg,Rg,Fn,Gn,Hn,In,Jn,Kn];var Sa=[Ln,Tc,Uc,Zd];var Ta=[Mn,sb,tb,Tb];var Ua=[Nn,ub,vb,Eb,Fb,Mb,Nb,Ub,Vb,hd,id,Ze,_e,bj,kj,Cj];var Va=[On,ud,ef,sg,aj,jj,Bj,Pn];var Wa=[Qn,$i,ij,Aj];return{__GLOBAL__sub_I_main_cpp:ch,___cxa_can_catch:Hj,___cxa_is_pointer_type:Ij,___em_js__getCanvasHeight:ab,___em_js__getCanvasWidth:$a,___errno_location:hh,___muldi3:Kj,___udivdi3:Pj,_bitshift64Lshr:Qj,_bitshift64Shl:Rj,_fflush:Ah,_free:fi,_i64Add:Lj,_i64Subtract:Mj,_llvm_bswap_i32:Sj,_main:db,_malloc:ei,_memcpy:Tj,_memset:Uj,_sbrk:Vj,dynCall_ii:Wj,dynCall_iii:Xj,dynCall_iiii:Yj,dynCall_v:Zj,dynCall_vi:_j,dynCall_vidi:$j,dynCall_vii:ak,dynCall_viid:bk,dynCall_viii:ck,dynCall_viiii:dk,dynCall_viiiii:ek,dynCall_viiiiii:fk,establishStackSpace:_a,stackAlloc:Xa,stackRestore:Za,stackSave:Ya}})


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

