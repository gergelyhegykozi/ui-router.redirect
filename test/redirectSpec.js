describe('redirect', function () {
  var $stateProvider, $httpBackend, $rootScope;

  beforeEach(module('ui.router.redirect', function(_$stateProvider_) {
    $stateProvider = _$stateProvider_;
  }));

  beforeEach(inject(function($injector) {
    $httpBackend = $injector.get('$httpBackend');
    $rootScope = $injector.get('$rootScope');

    $stateProvider
    .state('home', { url: "/" })
    .state('home.item', { url: "/:id" })
    .state('admin', { url: "/admin" })
    .state('admin.profile', { url: "/profile" })
    .state('admin.notFound', { url: "/notFound" });
  }));

  it('should redirect successfully with params', inject(function($state, $stateParams, $rootScope, $redirect) {
    $redirect.add(function(route) {
      if(route.name === 'home') {
        return {
            name: 'home.item',
            params: {
                id: 1
            }
        };
      }
      return true;
    });
    expect(function() {
      $state.go('home');
      $rootScope.$digest();
    }).not.toThrow();
    expect($state.current.name).toBe('home.item');
    expect($stateParams.id).toBe('1');
  }));

  it('should throw infinite loop error', inject(function($state, $stateParams, $rootScope, $redirect) {
    $redirect.add(function(route) {
      if(route.name === 'home') {
        return {
            name: 'home.item'
        };
      }
      if(route.name === 'home.item') {
        return {
            name: 'home'
        };
      }
      return true;
    });
    expect(function() {
      $state.go('home');
      $rootScope.$digest();
    }).toThrow(new Error('Infinite redirect loop'));
  }));

  it('should be prevented', inject(function($state, $stateParams, $rootScope, $redirect) {
    $redirect.add(function(route) {
      if(route.name === 'home') {
        return false;
      }
      return true;
    });
    expect(function() {
      $state.go('home');
      $rootScope.$digest();
    }).not.toThrow();
    expect($state.current.name).toBe('');
  }));

  it('should handle rejected promise', inject(function($state, $stateParams, $rootScope, $redirect, $http) {
    var spy = jasmine.createSpy('rejected');
    $httpBackend.expect('GET', '/api/users/1').respond(404);
    $redirect.add(function(route) {
      if(route.name === 'admin') {
          return $http.get('/api/users/1');
      }
      return true;
    });
    $redirect._go({
        name: 'admin'
    }).catch(spy);
    $httpBackend.flush();
    expect(spy).toHaveBeenCalled();
  }));

  it('should handle resolved promise', inject(function($state, $stateParams, $rootScope, $redirect, $q, $http) {
    var spy = jasmine.createSpy('resolved');
    $httpBackend.expect('GET', '/api/users/1').respond(200);
    $redirect.add(function(route) {
      var deferred = $q.defer();
      if(route.name === 'admin') {
          $http.get('/api/users/1').then(function() {
            deferred.resolve(true);   
          });
      }
      return deferred.promise;
    });
    $redirect._go({
        name: 'admin'
    }).then(spy);
    $httpBackend.flush();
    expect(spy).toHaveBeenCalled();
  }));

  it('should handle mixed chains', inject(function($state, $stateParams, $rootScope, $redirect, $q, $http) {
    var spy = jasmine.createSpy('resolved');
    $httpBackend.expect('GET', '/api/users/1').respond(200);
    $redirect.add(function(route) {
      var deferred = $q.defer();
      if(route.name === 'admin') {
        $http.get('/api/users/1').then(function() {
          deferred.resolve({
              name: 'admin.profile'
          });   
        });
      } else {
        deferred.resolve(true);
      }
      return deferred.promise;
    }).add(function(route) {
      var deferred = $q.defer();
      if(route.name === 'admin.profile') {
        deferred.resolve({
            name: 'admin.notFound'
        });   
      } else {
        deferred.resolve(true);
      }
      return deferred.promise;
    });
    $redirect._go({
      name: 'admin'
    }).then(function(route) {
       expect(route.name).toBe('admin.notFound');
       spy();
    });
    $httpBackend.flush();
    expect(spy).toHaveBeenCalled();
  }));

});

