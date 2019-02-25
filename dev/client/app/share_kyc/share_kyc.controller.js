(function () {
    'use strict';
    angular
        .module('MyBlockchain')
        .controller('shareKYCCtrl', shareKYCCtrl);

    function shareKYCCtrl($scope, $http) {
        $http({
            method: 'GET',
            url: '/fetch-service-providers'
        })
        .then(function(serviceRes) {
            $scope.services = serviceRes.data.keyList;
            console.log($scope.services);
        })

        $scope.shareKYCDetails = function() {
            $http({
                method: 'POST',
                url: '/encrypt-and-share',
                data: { userPrivKey: $scope.userPrivKey, servicePubKey: $scope.servicePubKey , inputEncryptedData: $scope.inputEncryptedData }
            })
            .then(function(shareRes) {
                console.log(shareRes.data);
            })
        }
    }

})();
