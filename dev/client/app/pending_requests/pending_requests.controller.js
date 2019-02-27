(function () {
    'use strict';
    angular
        .module('MyBlockchain')
        .controller('pendingReqCtrl', pendingReqCtrl);

    function pendingReqCtrl($scope, $http, toastService, $mdDialog) {
        $http({
            method: 'GET',
            url: '/fetch-pending-requests'
        })
        .then(function(pendingRes) {
            $scope.pendingRequestsList = pendingRes.data.pendingRequestsList;
            console.log($scope.pendingRequestsList);
        })

        $http({
            method: 'GET',
            url: '/fetch-service-providers'
        })
        .then(function(serviceRes) {
            $scope.services = serviceRes.data.keyList;
            //console.log($scope.services);
        })

        $scope.serviceSelected = function() {
            //console.log($scope.serviceName);
            $scope.pendingRequests = $scope.pendingRequestsList[$scope.serviceName];
            console.log($scope.pendingRequests);
        }

        $scope.viewKYC = function (transactionId, timestamp, encryptedData) {
            var data = { transactionId: transactionId, timestamp: timestamp, encryptedData: encryptedData};
            $mdDialog.show({
              controller: 'viewKYCCtrl',
              templateUrl: 'app/pending_requests/view_kyc_popup.html',
              locals: { dataToPass: data },
              parent: angular.element(document.body),
              clickOutsideToClose: true,
            })
          };
    }

})();
