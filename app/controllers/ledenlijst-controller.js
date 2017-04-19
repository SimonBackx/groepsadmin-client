(function () {
  'use strict';

  angular
    .module('ga.ledenlijstcontroller', [])
    .controller('LedenlijstController', LedenlijstController);

  LedenlijstController.$inject = ['$q','$filter','$log', '$scope', 'LedenFilterService', 'LedenLijstService', 'RestService', '$window', 'keycloak'];

  function LedenlijstController($q, $filter, $log, $scope, LFS, LLS, RestService, $window, keycloak) {
    // Kolommen sortable maken
    var index;


    $scope.isLoadingFilters = true;
    $scope.hasLoadedFilters = false;

    $scope.busy = false;
    $scope.end = false;
    $scope.aantalPerPagina = 10;
    $scope.leden = [];

    $("#mySortableList").sortable({
      placeholder: "my-sortable-placeholder",
      stop : function(event, ui){
        // zoek element mbv data-kolom-id en geef het de nieuwe index
        var kolId = $(ui.item[0]).attr('data-kolom-id');
        var foundKolom = _.find($scope.kolommen, {'id': kolId});
        var oldKolomIndex = foundKolom.kolomIndex;
        var newKolomIndex = ui.item.index();

        // alle kolomIndexen van de kolommen die achter het zonet gesleepte element komen, moeten met 1 worden verhoogd
        // (tot de kolommen die reeds achter het gesleepte element kwamen, want die behouden hun index)
        if(oldKolomIndex > newKolomIndex){
          var cols = _.filter($scope.kolommen, function(o){return o.kolomIndex >= newKolomIndex && o.kolomIndex < oldKolomIndex });
          _.each(cols,function(value,key){
            value.kolomIndex++;
          });
        }
        // alle kolomIndexen van de kolommen die voor het zonet gesleepte element komen, moeten met 1 worden verlaagd
        // (tot de kolommen die reeds voor het gesleepte element kwamen, want deze behouden hun index)
        if(oldKolomIndex < newKolomIndex){
          var cols = _.filter($scope.kolommen, function(o){return o.kolomIndex <= newKolomIndex && o.kolomIndex > oldKolomIndex });
          _.each(cols,function(value,key){
            value.kolomIndex--;
          });
        }

        // zet de nieuwe index op de gesleepte kolom
        foundKolom.kolomIndex = newKolomIndex;

        $scope.$apply();
      }
    });

    // controle on resize
    // angular.element($window).bind('resize', function () {
    //  if($(window).height() > $("#leden").height() && !$scope.busy){
    //    $scope.nextPage();
    //  }
    // });

    function initCriteriaKolommenFilters(){
      var deferred = $q.defer();
      var filterCriteria, filterKolommen, currentFilter, filters;
      $scope.isLoadingFilters = true;

      filterCriteria = LFS.getCriteria();
      filterKolommen = LFS.getKolommen();
      filters  = LFS.getFilters();
      //currentFilter = LFS.getFilter('huidige');

      // Alle criteria, kolommen, filters ophalen waarmee de gebruiker kan filteren
      // functies ophalen om functiegroepen van het 'verbond' en de 'groep' samen te stellen

      $q.all(filterCriteria.promises).then(function () {
        $scope.criteria = filterCriteria.arrCriteria;

        $q.all(filterKolommen.promises).then(function(){
          $scope.kolommen = filterKolommen.kolommen;

            $q.all(filters.promises).then(function(){
              $scope.filters = filters.filters;
              deferred.resolve();

            });
        });

      });

      return deferred.promise;

    }

    function stelFilterSamen(filterId){
      var deferred = $q.defer();

      var currFilter = LFS.getFilter(filterId);
      // Filter ophalen adhv filterId
      // Adhv deze Filter de geselecteerde criteria bepalen

        $q.all(currFilter.promises).then(function(){
          var arrPromises = [];
          //$log.debug('LFS -- getFilter by id: ' + filterId, currentFilter.currentFilter);
          $scope.currentFilter = currFilter.currentFilter;
          $scope.geselecteerdeCriteria = [];

          angular.forEach($scope.currentFilter.criteria, function(value, key){

            // neem alle functies uit criteria.functie 'functie' criteria
            // activeer alle functies
            if(key === "functies") {

              var promiseFunctie = RestService.Functies.get().$promise.then(
                function (response) {
                  angular.forEach(value, function(functieID) {
                    angular.forEach(response.functies, function(apiFunctie) {
                      if (apiFunctie.id == functieID) {
                        if(!LFS.bestaatFunctieGroep(apiFunctie, $scope.geselecteerdeCriteria)){
                          $scope.geselecteerdeCriteria = LFS.voegFunctieGroepToeAan(apiFunctie, $scope.geselecteerdeCriteria);
                        }
                        $scope.geselecteerdeCriteria = LFS.voegItemToeAanFunctieGroep(apiFunctie, $scope.geselecteerdeCriteria);
                      }
                    });
                  });
                }
              );

              arrPromises.push(promiseFunctie);

            }
            else if(key === "groepen") {
                var items = [];
                angular.forEach(value, function(groepsnummer){
                  var promiseGroep = RestService.Groep.get({id:groepsnummer}).$promise.then(
                    function(result){
                      var groep  = result;
                     items.push({
                          value : groep.groepsnummer,
                          label :  groep.naam + " [" + groep.groepsnummer + "]"
                        });
                    }
                  );
                  arrPromises.push(promiseGroep);

                });
                var tempselectedCriteria = {
                  title : key.charAt(0).toUpperCase() + key.slice(1),
                  criteriaKey : "groepen",
                  multiplePossible : true,
                  items: items
                }
                $scope.geselecteerdeCriteria.push(tempselectedCriteria);

            }
            else {
                var tempselectedCriteria = {
                  title : key.charAt(0).toUpperCase() + key.slice(1),
                  items : value
                }
                $scope.geselecteerdeCriteria.push(tempselectedCriteria);
            }
          });


          $q.all(arrPromises).then(function(){
            $log.debug('all groepen en functies resolved');
            deferred.resolve();
          });

        });



      return deferred.promise;
    }

    // Zet adhv de ingestelde filter, iedere criteriaCategorie en elk item in de criteriaCategorie op actief
    // Actieve criteriaGroepen worden getoond, Inactieve kunnen worden toegevoegd/geactiveerd
    // Actieve criteriaItems worden getoond, Inactieve kunnen worden toegevoegd/geactiveerd
    var activeerCriteria = function(){
      // haal alle criteriaGroepen keys uit de geselecteerde filter
      _.each($scope.currentFilter.criteria,function(value, key){
        // indien de key overeenkomt, activeren we de criteriaGroep
        // meerdere criteriaGroepen kunnen een zelfde key hebben
        // (bvb. groepspecifieke functies hebben de criteriaKey 'functies')
        var criteriaGroep = _.filter($scope.criteria, {'criteriaKey': key });
        if(criteriaGroep){
          if(criteriaGroep.length>1){
            _.each(criteriaGroep,function(v, k){
              LFS.activeerGroepEnItems(v,value);
            })
          }else if(criteriaGroep.length == 1){
            LFS.activeerGroepEnItems(criteriaGroep[0],value);
          }
        }

      });
    }

    $scope.isAllCriteriaActive = function(){
      return $scope.criteria.length == $filter('filter')($scope.criteria, {activated: true}).length;
    }
    $scope.addLastCriteriumIfThereIsOnlyOneLeft = function(){
      var deactivatedCriteria = $filter('filter')($scope.criteria, {activated: false});
      if(deactivatedCriteria.length == 1){
        $scope.activateCriterium(deactivatedCriteria[0]);
      }
    }

    $scope.toggleCriteriumItem = function(criteriumItem, type, criteriumItems){
      if(type == 'checkbox'){
        if(criteriumItem && !criteriumItem.activated){
          criteriumItem.activated = true;
        }else{
          criteriumItem.activated = false;
        }
      }else if(type == 'radio'){
        _.each(criteriumItems,function(value, key){
          value.activated = false;
        })
        criteriumItem.activated = true;
      }
    }

    $scope.getButtonSubtitleSuffix = function(obj){
      if(obj){
        if(obj.items!== undefined){
          obj = obj.items;
        }
        var actCritLength = _.filter(obj, {'activated' : true}).length;
        var str = '';
        if( actCritLength > 3){
          str = ', ...';
        }
        if(actCritLength == 0){
          str = '\u00A0';
        }
        return str;
      }
    }

    $scope.isAllCriteriumItemsSelected = function(criterium){
      if(_.filter(criterium.items, {'activated' : true}).length == criterium.items.length){
        return 'all';
      }else{
        if(_.filter(criterium.items, {'activated' : true}).length >=1){
          return 'some';
        }else{
          return 'none';
        }
      }
    }

    $scope.toggleAllCriteriumItems = function(criterium){
      if($scope.isAllCriteriumItemsSelected(criterium) == 'all'){
        _.each(criterium.items,function(value, key){
          value.activated  = false;
        });
      }else{
        _.each(criterium.items,function(value, key){
          value.activated  = true;
        });
      }
    }

    $scope.activateCriterium = function(crit){
      crit.activated = true;
      _.each(crit.items, function(value,key){
        value.activated = true;
      });
    }

    // controle is de criteria geselecteerd a.d.h.v. de titel
    var activeerEnIndexeerKolommen = function(){
      // activeer alle kolommen uit de toegepaste filter
      // en geef er een kolomIndex aan
      var counter = 0;
      _.each($scope.currentFilter.kolommen, function(value, key){
        var kolom = _.find($scope.kolommen, {'id': value});

        if(kolom){
          kolom.isLoaded = true;
          kolom.activated = true;
          kolom.kolomIndex = counter;
          counter++;
        }
      });
      indexeerNietActieveKolommen(counter);

    }

    var indexeerNietActieveKolommen = function(startCounter){
      // alle niet actieve kolommen krijgen ook een kolomIndex
      // deze zal door de gebruiker nog aangepast kunnen worden door de kolommen te verslepen
      var counter = startCounter;
      var nonActieveKolommen = _.filter($scope.kolommen, function(o){return !o.activated});
      _.each(nonActieveKolommen,function(value,key){
        value.kolomIndex = counter;
        counter++;
      })
    }

    $scope.toggleKolom = function(kol){
      if(kol.activated == undefined || kol.activated == false){
        kol.activated = true;
      }else{
        kol.activated = false;
      };
    }

    var createFilterObject = function(){
      var actFilterCriteria  = _.filter($scope.criteria, {"activated":true});
      // seleecteer alle actieve kolommen, gesorteerd op kolomIndex
      var tmpactKolommen  = _.orderBy(_.filter($scope.kolommen, {"activated":true}),'kolomIndex','asc');
      var actKolommen = [];

      // voor de patch van de filter hebben we enkel de kolom id's nodig
      _.each(tmpactKolommen, function(value){
        actKolommen.push(value.id);
      });

      var currentFilter = $scope.currentFilter;
      return LFS.getReconstructedFilterObject(actFilterCriteria, actKolommen, currentFilter);
    }

    var overwriteFilter = function(filter, obj){
      var deferred = $q.defer();
      console.log("===== overwriteFilter was called");
      obj.naam = filter.naam;

      LFS.saveFilter(filter.id, obj).then(
      function(result){
        console.log('response of overwriteFilter ', result);
        deferred.resolve(result);
      });

      return deferred.promise;

    }

    var createNewFilter = function(filterNaam){

      var reconstructedFilterObj = createFilterObject();
      reconstructedFilterObj.naam = filterNaam;

      return $q(function(resolve,reject){
        RestService.createNewFilter.post(reconstructedFilterObj).$promise.then(
          function(response){
            console.log('response of POST:'+ filterNaam, response);
            // 'huidige' filter opslaan
            resolve(response);
          }
        );
      });
    }

    $scope.saveOrOverwriteFilter = function(selectedFilter){
      $scope.isSavingFilters = true;
      var reconstructedFilterObj = createFilterObject();

      if(selectedFilter.id){
        var tmpObj = JSON.parse(JSON.stringify(reconstructedFilterObj));
        // bestaande filter overschrijven
        overwriteFilter(selectedFilter, tmpObj).then(function(response){
          console.log("saveOrOverwriteFilter", response);
          $scope.isSavingFilters = false;
          $scope.showSaveOptions = false;

          // instellen als huidige
          LFS.saveFilter('huidige', reconstructedFilterObj);

        });
      }else{
        // voor de zekerheid leading en trailing whitespaces trimmen
        selectedFilter = selectedFilter.trim();
        var filters = LFS.getFilters();
        var tmpObj = JSON.parse(JSON.stringify(reconstructedFilterObj));
        $q.all(filters.promises).then(function(){
          // eerst checken of de naam niet overeenkomt met bestaande filter
          // TODO: check op lowercased
          var foundElem = _.find(filters.filters, {'naam' : selectedFilter});
          if(foundElem !== undefined){
            var filterObj = {};
            filterObj.naam = foundElem.naam;
            filterObj.id = foundElem.id;
            // indien overeenkomt, eigen functie opnieuw aanroepen met filter naam en id
            $scope.saveOrOverwriteFilter(filterObj);
          }else{
          // indien de naam niet bestaat, maak nieuwe filterObj
            createNewFilter(selectedFilter).then(function(res){
              $scope.isSavingFilters = false;
              $scope.showSaveOptions = false;
              console.log("new filter created in 'saveOrOverwriteFilter' ", res);
            });
          }


        });

      }

    }

    $scope.changeFilter = function(filter){
      $scope.isLoadingFilters = true;
      stelFilterSamen(filter.id).then(function(){
        $scope.isLoadingFilters = false;

        activeerCriteria();
        activeerEnIndexeerKolommen();

        var reconstructedFilterObj = createFilterObject();
        $scope.isSavingFilters = true;

        LFS.saveFilter('huidige', reconstructedFilterObj).then(
        function(response){
          $scope.isSavingFilters = false;
          // ledenlijst leegmaken
          $scope.leden = [];
          console.log('response of save ', response);
          $scope.ledenLaden();
        });

      });
    }

    $scope.applyFilter = function(){

      var reconstructedFilterObj = createFilterObject();
      $scope.isSavingFilters = true;

      LFS.saveFilter('huidige', reconstructedFilterObj).then(
      function(response){
        $scope.isSavingFilters = false;
        _.each($scope.kolommen, function(val){val.isLoaded = true;});
        // ledenlijst leegmaken
        $scope.leden = [];
        console.log('response of save ', response);
        $scope.ledenLaden();
      });

    }

    /*
     * Infinity scroll
     * -----------------------------------------------------------
     */

    // controle moet er meer leden ingeladen worden
    $scope.ledenLaden = function(){
      $scope.isLoadingLeden = true;
      var offset = 0;
      var aantalPerPagina = 1000
      LLS.getLeden(aantalPerPagina, 0).then(
        function(res){
          _.each(res.leden, function(val,key){
            $scope.leden.push(val);
          })

          $scope.totaalAantalLeden = res.totaal;
          $scope.offset = res.offset;
          $scope.busy = false;
          $scope.isLoadingLeden = false;

        }
      );
    }

    $scope.meerLaden = function(last){
      if(last && $(window).height() > $("#leden").height()){
        console.log('nextPage()');
        $scope.nextPage();
      }
    }

    // functie die aangeroepen word om (meer) leden op te halen via de api
    $scope.nextPage = function(){
      if ($scope.busy) return;
      $scope.busy = true;
      // voorkom dat er request gedaanworden wanneer alle resultaaten geladen zijn
      if($scope.leden.length !== $scope.totaalAantalLeden){
        var offset = $scope.leden.length == 0 ? 0 : $scope.leden.length;
        LLS.getLeden($scope.aantalPerPagina, offset).then(
          function(res){
            $scope.leden.push.apply($scope.leden,res.leden);
            $scope.totaalAantalLeden = res.totaal;
            $scope.offset = res.offset;
            $scope.busy = false;

          }
        );
      }
      else{
        $scope.busy = false;
        //$scope.end = true;
      }
    }

    /*
     * Sortering
     * ------------------------------------------------------------------
     */

    // controle voor de sortering
    // returnt het nummer volgens de volgorde van de sortering als de kolom in de sortering zit en
    // wanner de volgorde die meegegeven is overeenkomt met de volgorde in de sortering.

    $scope.sortering = function(kolomId, volgorde){
      var returnValue = false;
      angular.forEach($scope.currentFilter.sortering, function(value,key){
        if(value.kolom == kolomId && value.oplopend == volgorde){
          switch(key){
            case 0:
                returnValue = 1;
                break;
              case 1:
                returnValue = 2;
                break;
              case 2:
                returnValue = 3;
                break;
          }
        }
      });
      return returnValue;
    }

    // uitvoeren van van een sortering.
    $scope.addSort = function(kolomId, volgorde){
      var originalSort = $scope.currentFilter.sortering;
      //$log.debug("originalSort --- ",originalSort);

      // controle werd er geclicked op een sort die reeds in de sortering zit => delete from sortering
      var deleteFromSort = false;
      angular.forEach(originalSort, function(value){
        if(value.kolom == kolomId && value.oplopend == volgorde){
          deleteFromSort = true;
          return;
        }
      });

      // nieuwe sortering toevoegen aan de set
      if(!deleteFromSort){
        $scope.currentFilter.sortering = []
        $scope.currentFilter.sortering[0] = {
          kolom : kolomId,
          oplopend : volgorde
        };
      } else{
        $scope.currentFilter.sortering = []
      }


      // laatste 2 van de oude sort toevoegen
      // controle zat de nieuwe al in de sortering?
      angular.forEach(originalSort, function(value){
        if($scope.currentFilter.sortering.length == 3){
          return;
        }
        if(value.kolom != kolomId){
          $scope.currentFilter.sortering[$scope.currentFilter.sortering.length] = value;
        }

      });

      // leden herladen of als ze allemaal gelanden zijn lokaal filteren.
        // indien herladen moet worden éérst filter opslaan
          //controle is de huidige filter een opgeslagen filter ?
           // ja nieuwe filter maken van huidige filter.
      if($scope.totaalAantalLeden == $scope.leden.length){
        // lokaal hersorteren.
      }

    }

    initCriteriaKolommenFilters().then(function(){

      //console.log("initCriteriaKolommenFilters!");
      stelFilterSamen('huidige').then(function(){
        $scope.isLoadingFilters = false;
        // variable om te voorkomen dat content flikkert
        $scope.hasLoadedFilters = true;
        activeerCriteria();
        activeerEnIndexeerKolommen();
        $scope.ledenLaden();

      });


    });

}

})();
