# angular-ui-router.redirect
A helper module for AngularUI Router, which allows you to handle redirect chains.

## Features
* Handle the page conditions / requirements separately before it reaches the routing
* Handle the rejected(otherwise) and notFound states separately

## Important note
The module doesn't handle state options with the official 0.2.15
With that commit you can fix that:
https://github.com/angular-ui/ui-router/pull/2212

## Installation
1. `bower install angular-ui-router.redirect`
2. Reference `dist/angular-ui-router.redirect.min.js`.
3. Add a dependency on `ui.router.redirect` in your app module.

## Usage

``` javascript
angular.module('myApp', [ 'ui.router', 'ui.router.redirect' ])
.config(function($redirectProvider){
    $redirectProvider.setDebug(true);
    $redirectProvider.otherwise(function($injector) {
        var $state = $injector.get('$state');
        $state.go('pageRejected', {}, { location: false });
    });
    $redirectProvider.notFound(function($injector) {
        var $state = $injector.get('$state');
        $state.go('pageNotFound', {}, { location: false });
    });
})
.run(function($redirect, $q, authService) {
    $redirect
    .add('home', home)
    //Catch every state in admin
    .add('admin.*', admin);

    function home(route) {
        //Redirect to the home.main state
        return {
            name: 'home.main',
            params: route.params
        };
    }

    function admin(route) {
        var deferred = $q.defer();

        /*
         Call the authenticator and store the promise, so we can do that in the ui-router:
         resolve: {
            user: function($redirect) {
                return $redirect.get('user');
            }
         }
         Note: The service should have a proper caching layer to avoid unnecessary requests
         */
        this.set('user', authService.load())
        //If the user was resolved then check further conditions. In other case deny the change.
        .then(authenticated, deferred.reject);

        function authenticated() {
            deffered.resolve(true);
            //Go to the admin home page
            if(route.name === 'admin') {
                deffered.resolve({
                    name: 'admin.home'
                });
            //In any other case we dont care in this block and approve the change
            } else {
                deffered.resolve(true);
            }
        }

        return deferred.promise;
    }
});
```

## $redirectProvider

### otherwise(callback)
The callback will be called if the redirection was rejected
* callback($injector) {function} 

### notFound(callback)
The callback will be called if the target was not found
* callback($injector) {function} 

### setDebug(debug)
Debug the redirections in the console
* debug {boolean}

## $redirect

## add([condition, ]callback):
The callback will be called recursively
* condition {regexp}
* callback(route) {function}

### callback return:
* Basic option: false {boolean}: Deny the change
* Basic option: true {boolean}: Approve the change
* Basic option: route {object}: Redirect to
    * name {string} (required): ui-router state name
    * params {object}: ui-router state params
    * options {object}: ui-router state options
* Promise {object}
    * Resolve with a basic option
    * Reject will deny the change

## set(key, value)
Store anything to reuse it later - it is useful to store promises that you can reuse in the ui-router resolve object

## get(key)
Return the stored object

## Events

### $redirectStart

### $redirectNotFound
