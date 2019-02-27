(function () {
  'use strict';
  angular
    .module('MyBlockchain')
    .config(function ($stateProvider, $urlRouterProvider) {
      $urlRouterProvider.otherwise("/menu/transaction-explorer");

      $stateProvider
        .state('menu', {
          url: '/menu',
          templateUrl: 'app/menu/menu.html',
          controller: 'MenuCtrl',
          controllerAs: 'menu'
        })
        .state('menu.transaction-explorer', {
          url: '/transaction-explorer',
          templateUrl: 'app/transaction_explorer/transaction_explorer.html',
          controller: 'transactionExplorerCtrl',
          controllerAs: 'transactionExplorer'
        })
        .state('menu.blockchain-explorer', {
          url: '/blockchain-explorer',
          templateUrl: 'app/blockchain_explorer/blockchain_explorer.html',
          controller: 'blockchainExplorerCtrl',
          controllerAs: 'blockchainExplorer'
        })
        // .state('menu.upload-files', {
        //   url: '/upload-files',
        //   templateUrl: 'app/upload_files/upload_files.html',
        //   controller: 'uploadFilesCtrl',
        //   controllerAs: 'uploadFiles'
        // })
        .state('menu.user-registration', {
          url: '/user-registration',
          templateUrl: 'app/user_registration/user_registration.html',
          controller: 'userRegCtrl',
          controllerAs: 'userReg'
        })
        .state('menu.service-registration', {
          url: '/service-registration',
          templateUrl: 'app/service_registration/service_registration.html',
          controller: 'serviceRegCtrl',
          controllerAs: 'serviceReg'
        })
        .state('menu.share-kyc', {
          url: '/share-kyc',
          templateUrl: 'app/share_kyc/share_kyc.html',
          controller: 'shareKYCCtrl',
          controllerAs: 'shareKYC'
        })
        .state('menu.pending-requests', {
          url: '/pending-requests',
          templateUrl: 'app/pending_requests/pending_requests.html',
          controller: 'pendingReqCtrl',
          controllerAs: 'pendingReq'
        })
    });

})();