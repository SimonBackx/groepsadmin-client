(function () {
  'use strict';

  angular
    .module('ga.route', ['ngRoute'])
    .config(configure);

  configure.$inject = ['$routeProvider', '$locationProvider'];

  function configure($routeProvider, $locationProvider) {
    // Configure the routes
    $routeProvider

      .when('/ledenlijst', {
        templateUrl: 'partials/leden.html',
        controller: 'LedenlijstController',
        resolve : {
          access: ["UserAccess", function (UserAccess) { return UserAccess.hasAccessTo("ledenlijst").then(function(res){ return res }); }]
        }
      })

      .when('/lid/toevoegen', {
        templateUrl: 'partials/lid-toevoegen.html',
        controller: 'LidToevoegenController',
        resolve : {
          access: ["UserAccess", function (UserAccess) { return UserAccess.hasAccessToGroepen().then(function(res){ return res }); }]
        }
      })

      .when('/lid/:id', {
        templateUrl: 'partials/lid.html',
        controller: 'LidController'
      })

      .when('/lid/individuelesteekkaart/:id', {
        templateUrl: 'partials/lid-individuele-steekkaart.html',
        controller: 'LidIndividueleSteekkaartController'
      })

      .when('/groepsinstellingen', {
        templateUrl: 'partials/groepsinstellingen.html',
        controller: 'GroepController',
        resolve : {
          access: ["UserAccess", function (UserAccess) { return UserAccess.hasAccessToGroepen().then(function(res){ return res }); }]
        }
      })

      .when('/orakel', {
        templateUrl: 'partials/orakel.html',
        controller: 'OrakelController',
        resolve : {
          access: ["UserAccess", function (UserAccess) { return UserAccess.hasAccessTo("ledenlijst").then(function(res){ return res }); }]
        }
      })

      .when('/feedback', {
        templateUrl: 'partials/feedback.html',
        controller: 'FeedbackController'
      })

      .otherwise({
        redirectTo: '/ledenlijst'
      });
  }
})();
