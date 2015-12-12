'use strict';

angular.module('ngStorableResource', ['ngResource', 'LocalStorageModule'])
  .factory('StorableResource', function ($resource) {

    return $resource;

  });
