'use strict';

angular.module('ngStorableResource', ['ngResource', 'LocalStorageModule'])
  .provider('storableResource', function ($resourceProvider) {

    var provider = this;

    var defaultActions = $resourceProvider.defaults.actions;

    var Collection = function (objects) {

      if (_.isArray(objects)) {
        this.objects = objects;
      } else {
        this.objects = [];
      }
    };

    var methods = ['forEach', 'each', 'map', 'collect', 'reduce', 'foldl',
      'inject', 'reduceRight', 'foldr', 'find', 'detect', 'filter', 'select',
      'reject', 'every', 'all', 'some', 'any', 'include', 'contains', 'invoke',
      'max', 'min', 'toArray', 'size', 'first', 'head', 'take', 'initial', 'rest',
      'tail', 'drop', 'last', 'without', 'difference', 'indexOf', 'shuffle',
      'lastIndexOf', 'isEmpty', 'chain', 'sample'
    ];

    _.each(methods, function (method) {
      Collection.prototype[method] = function () {
        var args = Array.prototype.slice.call(arguments);
        args.unshift(this.objects);
        return _[method].apply(_, args);
      };
    });

    // Underscore methods that take a property name as an argument.
    var attributeMethods = ['groupBy', 'countBy', 'sortBy', 'indexBy'];

    // Use attributes instead of properties.
    _.each(attributeMethods, function (method) {
      Collection.prototype[method] = function (value, context) {
        var iterator = _.isFunction(value) ? value : function (model) {
          return model.value;
        };
        return _[method](this.objects, iterator, context);
      };
    });


    angular.extend(Collection.prototype, {

      add: function (object) {
        if (!object) return this;
        if (_.isArray(object)) {

          var objects = object;
          while (objects.length) {
            var pop = objects.pop();
            this.objects.push(pop);
          }

        } else {
          this.objects.push(object);
        }
        return this;
      },

      remove: function (object) {
        var index = this.indexOf(object);
        this.objects.splice(index, 1);
      },

      count: function () {
        return this.objects.length;
      },

    });

    this.$get = function ($q, $resource, localStorageService) {

      var storableResource = function (url, paramDefaults, actions, options, instanceMethods, staticMethods, collectionMethods) {

        actions = actions || {};

        var ResourceClass = $resource(url, paramDefaults, actions, options);

        angular.extend(ResourceClass.prototype, {

          localFetch: function () {
            var equivalent = this.localFindEquivalent();
            angular.extend(this, equivalent);
            return this;
          },

          localFindEquivalent: function () {
            var equivalentAttributes = this.localFindRawEquivalent();
            if (equivalentAttributes) {
              return ResourceClass.createModelInstance(equivalentAttributes);
            }
          },

          localFindRawEquivalent: function () {
            var _this = this;
            var thisAttributes = this;
            var attributesTobeSaved = _.find(ResourceClass.attributesList, function (attributes, i) {
              return (attributes.objectId && attributes.objectId == _this.id) || (attributes.localId && attributes.localId == thisAttributes.localId);
            });
            return attributesTobeSaved;
          },

          localIndex: function () {
            return ResourceClass.attributesList.indexOf(this.localFindRawEquivalent());
          },

          next: function () {
            var index = this.localIndex();
            if (index > 0) {
              var attributes = ResourceClass.attributesList[index - 1];
              return ResourceClass.createModelInstance(attributes);
            }
          },

          prev: function () {
            var index = this.localIndex();
            var attributesList = ResourceClass.attributesList;
            if (index < attributesList.length - 1) {
              var attributes = attributesList[index + 1];
              return ResourceClass.createModelInstance(attributes);
            }
          },

          /**
           *
           *
           */
          saveLocal: function (attributes) {
            if (_.isObject(attributes)) this.extend(this, attributes);
            this._saveLocal();
            return ResourceClass.write();
          },

          _saveLocal: function () {

            var equivalent = this.localFindRawEquivalent();
            if (equivalent) {
              angular.extend(equivalent, this.attributes);
            } else {
              this.localId = Math.random().toString();
              ResourceClass.attributesList.push(this.attributesForLocal());
            }

          },

          destroyLocal: function () {
            var index = this.localIndex();
            ResourceClass.attributesList.splice(index, 1);
            ResourceClass.write();
          },

          attributesForLocal: function () {
            var obj = angular.extend({}, this.toJSON(), {
              objectId: this.id
            });
            delete obj.ACL;
            return obj;

          },

          afterRetrieve: function () {

          },

        }, instanceMethods);

        var propNames = [].concat(Object.getOwnPropertyNames(ResourceClass)).concat(Object.getOwnPropertyNames(actions));
        _.each(propNames, function (propName) {

          if ('bind' == propName) return;

          var func = ResourceClass[propName];
          if (!(func instanceof Function)) return;

          ResourceClass[propName] = function () {

            var args = Array.prototype.slice.call(arguments);

            var ret = func.apply(this, args);

            if (_.isArray(ret)) {
              var deferred = $q.defer();
              var collection = new Collection(ret);
              ret.$promise.then(function () {
                deferred.resolve(collection);
              }, function (error) {
                deferred.reject(error);
              });
              collection.$promise = deferred.promise

              return collection;
            } else {
              return ret;
            }
          };

        });

        angular.extend(ResourceClass, {

          initialize: function () {
            this.localInit();
          },

          collectionFromAttributesList: function (attributesList) {

            var _attributesList = attributesList || this.attributesList;

            var collection = new this.Collection();
            var _this = this;
            _.each(_attributesList, function (attributes, i) {

              var model = _this.createModelInstance(angular.copy(attributes));
              collection.add(model);
            });

            return collection;
          },

          syncToLocal: function () {
            var deferred = $q.defer();
            deferred.resolve();
            return deferred.promise;
          },

          localFind: function (localId) {
            var attributes = _.find(this.attributesList, function (attributes, i) {
              return attributes.localId === localId;
            });
            return this.createModelInstance(attributes);
          },

          localFindById: function (id) {
            var attributes = _.find(this.attributesList, function (attributes, i) {
              return attributes.objectId === id;
            });
            return this.createModelInstance(attributes);
          },

          /**
           * Save localCollection to localStorage
           *
           */
          write: function () {
            var deferred = $q.defer();

            var localConfig = this.localConfig;
            var className = localConfig.name;
            var localStorageKey = className;

            var newAttributesList = [];

            _.each(this.attributesList, function (model, i) {
              newAttributesList.push(model);
            });
            localStorageService.set(localStorageKey, newAttributesList);

            deferred.resolve();
            return deferred.promise;
          },

          /**
           * Get localCollection from localStorage.
           *
           * @returns {Promise}
           */
          read: function () {
            console.time('read');

            var start = new Date().getTime();
            var deferred = $q.defer();

            var localConfig = this.localConfig;
            var className = localConfig.name;
            var localStorageKey = className;

            var attributesList = this.attributesList = localStorageService.get(localStorageKey);

            this.afterRead();
            console.log('read:' + (new Date().getTime() - start));
            console.timeEnd('read');

            deferred.resolve(attributesList);

            return deferred.promise;
          },

          afterRead: function () {

          },

          /**
           * This method is called after retrieved from cached
           *
           * @returns {Object}
           */
          createModelInstance: function (attributes) {
            attributes = angular.copy(attributes) || {};
            if (attributes.date) {
              attributes.date = new Date(attributes.date);
            }

            var model = new this(attributes);
            model.afterRetrieve();
            return model;
          },

          localInit: function () {

            var localConfig = this.localConfig;
            if (!localConfig) return;

            var className = localConfig.name;

            if (this.initialized) {
              return;
            }

            if (!localStorageService.get(className)) {
              localStorageService.set(className, []);
            }

            if (!this.attributesList) {
              this.attributesList = [];
            }

            this.initialized = true;

            this.read();
          },

        }, {
          Collection: Collection
        }, staticMethods);

        angular.extend(Collection.prototype, collectionMethods);

        ResourceClass.localInit();
        return ResourceClass;
      };


      return storableResource;
    };

  });
