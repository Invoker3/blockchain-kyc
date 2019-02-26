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
                url: '/fetch-transactionId',
                data: { inputEncryptedData: $scope.inputEncryptedData }
            })
            .then(function(fetchRes) {
                console.log(fetchRes.data);
                $scope.transactionId = fetchRes.data.transactionId;
                $scope.timestamp = fetchRes.data.timestamp;
                $http({
                    method: 'POST',
                    url: '/encrypt-and-share',
                    data: { userPrivKey: $scope.userPrivKey, servicePubKey: $scope.servicePubKey.pubkey , inputEncryptedData: $scope.inputEncryptedData, serviceName: $scope.servicePubKey.name, transactionId: $scope.transactionId, timestamp: $scope.timestamp  }
                })
                .then(function(shareRes) {
                    console.log(shareRes.data);
                })
            })
            
        }
    }

})();
