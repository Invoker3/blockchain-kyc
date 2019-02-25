(function () {
  'use strict';

  angular.module('MyBlockchain')
    .service('navService', [
      '$q',
      navService
    ]);

  function navService($q) {
    var menuItems = [
      {
        name: 'Blockchain Explorer',
        icon: 'dashboard',
        sref: '.blockchain-explorer'
      },
      {
        name: 'Transaction Explroer',
        icon: 'security',
        sref: '.transaction-explorer'
      },
      {
        name: 'Upload Files',
        icon: 'backup',
        sref: '.upload-files'
      },
      {
        name: 'User Registration',
        icon: 'people',
        sref: '.user-registration'
      },
      {
        name: 'Service Registration',
        icon: 'location_city',
        sref: '.service-registration'
      },
      {
        name: 'Share KYC',
        icon: 'share',
        sref: '.share-kyc'
      }
    ];

    return {
      loadMenuItems: function () {
        return $q.when(menuItems);
      }
    };
  }

})();
