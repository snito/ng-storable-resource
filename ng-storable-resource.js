'use strict';

angular.module('ngStorableResource', ['LocalStorageModule'])
  .factory('StorableResource', function ($resource) {

    return $resource;

  });
