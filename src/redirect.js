/**
 * A helper module for AngularUI Router, which allows you to handle redirect chains
 */
(function() {

  'use strict';

  angular.module('ui.router.redirect', ['ui.router'])
  .provider('$redirect', redirectProvider);

  redirectProvider.$inject = ['$urlRouterProvider'];
  function redirectProvider($urlRouterProvider) {

    var otherwiseCallback = angular.noop,
        notFoundCallback = angular.noop,
        debug = false;

    Redirect.$inject = ['$rootScope', '$state', '$q', '$timeout', '$injector'];

    return {
      otherwise: otherwise,
      notFound: notFound,
      setDebug: setDebug,
      $get: Redirect
    };

    /**
     * Callback if the redirection was rejected
     * @params {function} callback
     */
    function otherwise(callback) {
      otherwiseCallback = callback;
    }

    /**
     * Callback if the state was not found
     * @params {function} callback
     */
    function notFound(callback) {
      notFoundCallback = callback;
      $urlRouterProvider.otherwise(callback);
    }

    /**
     * Turn on/off the debugger
     * @params {boolean} debug
     */
    function setDebug(_debug) {
      debug = !!_debug;
    }

    function Redirect($rootScope, $state, $q, $timeout, $injector) {
      var callbackQueue = [],
          redirectQueue = [],
          redirectAccepted = false,
          callIndex = 0,
          cache = {},
          redirectScope = {
            add: add,
            _go: go,
            set: set,
            get: get
          };

      $rootScope.$on('$stateChangeStart', stateChangeStart);

      return redirectScope;

      /**
       * Approve / Deny the ui-router's change
       */
      function stateChangeStart(event, toState, toParams, fromState, fromParams, options) {
        //Initiate checks
        if(!redirectAccepted) {
          event.preventDefault();
          $rootScope.$broadcast('$redirectStart', toState, toParams);
          go({
            name: toState.name,
            params: toParams,
            //Fallback for older versions
            options: options || {}
          });
        }
      }

      /**
       * Define new redirect handler
       * @params callback {function}
       * Redirect handler. First param is the targeted route.
       * Possible options to return:
       *
       * Basic options:
       * false {boolean}: Deny the change
       * true {boolean}: Approve the change
       * route {object}: Redirect to this route
       * 
       * promise {object}:
       *    Resolve with a basic option
       *    Reject: Deny the change
       */
      function add(callback) {
        callbackQueue.push(callback);
        return this;
      }

      /**
       * Initiate the redirection of the specified route
       * @params {object} route
       * name
       * params
       * options
       */
      function go(route) {
        var deferred = $q.defer();
        //Doesn't exist in the redirect chain
        if(!isProcessed(route)) {
          redirectQueue = [];
          var result = checkRedirectQueue(route, ++callIndex);
          if(!result) {
            deferred.reject();
          } else if(result.then) {
            return result;
          } else {
            deferred.resolve(result);
          }
        } else {
          deferred.resolve(true);
        }
        return deferred.promise;
      }

      /**
       * Cache setter
       * @params {string} key
       * @params {mixed} value
       */
      function set(key, value) {
        cache[key] = value;
        return cache[key];
      }

      /**
       * Cache getter
       * @params {string} key
       */
      function get(key) {
        return cache[key];
      }

      /**
       * Check the targeted route in the redirect chain
       * @params {object} route
       */
      function isProcessed(route) {
        var i = 0,
            redirectQueueLength = redirectQueue.length;

        for(; i < redirectQueueLength; i++) {
          if(angular.equals(route, redirectQueue[i])) {
            return true;
          }
        }

        return false;
      }

      /**
       * New item into the redirect chain
       * @params {object} route
       */
      function addToRedirectQueue(route) {
        var i = 0,
            redirectQueueLength = redirectQueue.length,
            _route = angular.copy(route);

        if(debug) {
          console.info('Redirect to:', _route);
        }

        for(; i < redirectQueueLength; i++) {
          if(angular.equals(_route, redirectQueue[i])) {
            console.info('Redirect queue:', redirectQueue);
            throw new Error('Infinite redirect loop');
          }
        }

        redirectQueue.push(_route);
      }

      /**
       * Check every redirect function and resolve them 
       * @params {object} route
       * @params {object} _callIndex
       * Private callcounter
       */
      function checkRedirectQueue(route, _callIndex) {
        var i = 0,
            result = true,
            check = function(route, ignoreRedirectQueue) {

              route.params = route.params || {};
              route.options = route.options || {};

              //New redirect was triggered - cancel the current one
              if(callIndex !== _callIndex) {
                return false;
              }

              //Approved and every callback was checked
              if(i === callbackQueue.length) {
                if(route && route.name) {
                  _go(route);
                }
                return route;
              }

              if(!ignoreRedirectQueue) {
                addToRedirectQueue(route);
              }

              result = callbackQueue[i].call(redirectScope, route);

              return handle(route, result);
            },
            handle = function(route, result) {
              //Promise
              if(result && result.then) {
                var deferred = $q.defer();
                result.then(function(_result) {
                  deferred.resolve(handle(route, _result));
                }, function(_result) {
                  $timeout(function() {
                    otherwiseCallback($injector);
                  });
                  deferred.reject(); 
                });
                return deferred.promise;
              //Redirect
              } else if(result && result.name) {
                return checkRedirectQueue(result, _callIndex);
              //Approved - next callback
              } else if(result === true) {
                i++;
                return check(route, true);
              //Don't go
              } else if(!result) {
                reset();
                $timeout(function() {
                  otherwiseCallback($injector);
                });
                return false;
              //Wrong format
              } else {
                throw new Error('Wrong redirect format');
              }
            };

        return check(route);
      }

      /**
       * Reset the service
       */
      function reset() {
        redirectQueue = [];
        callIndex = 0;
      }

      /**
       * Enable and redirect
       * @param {object} route
       */
      function _go(route) {
        var stateFound = $state.get(route.name);

        reset();

        if(!stateFound) {
          $rootScope.$broadcast('$redirectNotFound', route);
        }
        if(!stateFound && notFoundCallback !== angular.noop) {
          notFoundCallback($injector);
        } else {
          redirectAccepted = true;
          $state.go(route.name, route.params, route.options);
          redirectAccepted = false;
        }
      }

    }

  }

})();
