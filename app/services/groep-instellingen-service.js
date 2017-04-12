(function() {
  'use strict';

  angular
    .module('ga.services.groepinstellingen', [])
    .factory('GroepInstellingenService', GroepInstellingenService);

  GroepInstellingenService.$inject = ['$log','$q','RestService'];

  // Deze service bevat een aantal helper functies die voornamelijk worden gebruikt door de groepController

  function GroepInstellingenService($log,$q,RestService) {
    var gis = {};

    gis.getGroepen = function(){
      return $q(function(resolve,reject){
      RestService.Groepen.get().$promise.then(
        function (result) {
          var data = {};
          data.groepenlijst = [];
          //tijdelijk extra velden toevoegen aan het resultaat
          _.each(result.groepen, function(value){
            value.vga = {
              "naam": "Luke Skywalker",
              "email": "luke@walkingin.sky"
            };
            value.groepsleiding = [
              {
                "naam": "Foo bar",
                "email": "foo@bar.com"
              },
              {
                "naam": "John doe",
                "email": "john@doe.com"
              }];

            value.adres = [
              value.adres
            ];
            data.groepenlijst.push(value);
          })

          // by default is de eerste groep actief
          data.activegroup = data.groepenlijst[0];
          resolve(data);
        },
        function (Error){
        }
      );
      });
    }





    return gis;
  };
})();
