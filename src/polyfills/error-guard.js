/**
 * React Native ErrorUtils polyfill for Hermes and Metro runtimes
 */
(function (global) {
  'use strict';

  if (global.ErrorUtils && typeof global.ErrorUtils.setGlobalHandler === 'function') {
    return;
  }

  var _inGuard = 0;
  var _globalHandler = function (e, isFatal) {
    console.error('Unhandled JS Exception:', e);
    if (isFatal) {
      throw e;
    }
  };

  var ErrorUtils = {
    setGlobalHandler: function (fun) {
      _globalHandler = fun;
    },
    getGlobalHandler: function () {
      return _globalHandler;
    },
    reportError: function (error) {
      if (_globalHandler) {
        _globalHandler(error, false);
      } else {
        console.error(error);
      }
    },
    reportFatalError: function (error) {
      if (_globalHandler) {
        _globalHandler(error, true);
      } else {
        throw error;
      }
    },
    applyWithGuard: function (fun, context, args) {
      try {
        _inGuard++;
        return fun.apply(context, args);
      } catch (e) {
        ErrorUtils.reportError(e);
      } finally {
        _inGuard--;
      }
    },
    applyWithGuardIfNeeded: function (fun, context, args) {
      if (ErrorUtils.inGuard()) {
        return fun.apply(context, args);
      } else {
        return ErrorUtils.applyWithGuard(fun, context, args);
      }
    },
    inGuard: function () {
      return _inGuard > 0;
    },
    guard: function (fun, name, context) {
      if (typeof fun !== 'function') {
        console.warn('A function must be supplied to ErrorUtils.guard, got ' + fun);
        return null;
      }
      var guardName = name || fun.name || '<generated guard>';
      function guarded() {
        return ErrorUtils.applyWithGuard(
          fun,
          context || this,
          arguments,
          null,
          guardName
        );
      }
      return guarded;
    },
  };

  global.ErrorUtils = ErrorUtils;
})(typeof globalThis !== 'undefined' ? globalThis : typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);
