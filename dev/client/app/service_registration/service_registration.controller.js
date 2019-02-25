(function () {
    'use strict';
    angular
        .module('MyBlockchain')
        .controller('serviceRegCtrl', serviceRegCtrl);

    function serviceRegCtrl($scope, $http, toastService) {
        $scope.newServiceRegister = function () {
            $http({
                method: 'GET',
                url: '/blockchain',
            })
                .then(function (blockRes) {
                    var duplicateFlag = false;
                    blockRes.data.chain.forEach(block => {
                        block.transactions.forEach(transaction => {
                            if (transaction.keyName == $scope.keyName)
                                duplicateFlag = true;
                        })
                    });

                    if (duplicateFlag)
                        toastService.Notify('Keyname already exists! Try again.')
                    else {
                        $http({
                            method: 'POST',
                            url: '/generate-keypair',
                            data: { keyName: $scope.keyName, keyType: 'services' }
                        })
                            .then(function (keypairRes) {
                                if (keypairRes.data.note == 'Public/Private keypair generated for ' + $scope.keyName) {
                                    $http({
                                        method: 'POST',
                                        url: '/send-email',
                                        data: { keyName: $scope.keyName, keyType: 'services', recipient: $scope.email }
                                    })
                                        .then(function (emailRes) {
                                            if (emailRes.data.note == 'Email sent successfully') {
                                                toastService.Notify('Service Provider register successfully!');
                                            }
                                        })
                                }
                            })

                    }
                })
        }
    }

})();
