(function () {
    'use strict';
    angular
        .module('MyBlockchain')
        .controller('pendingReqCtrl', pendingReqCtrl);

    function pendingReqCtrl($scope, $http, toastService) {
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
    }

})();
