(function () {
    'use strict';
    angular
        .module('MyBlockchain')
        .controller('userRegCtrl', userRegCtrl);

    function userRegCtrl($scope, $http, toastService) {
        $scope.newUserRegister = function () {
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
                            data: { keyName: $scope.keyName }
                        })
                            .then(function (keypairRes) {
                                if (keypairRes.data.note == 'Public/Private keypair generated for ' + $scope.keyName) {
                                    $http({
                                        method: 'POST',
                                        url: '/send-email',
                                        data: { keyName: $scope.keyName, recipient: $scope.email }
                                    })
                                        .then(function (emailRes) {
                                            if (emailRes.data.note == 'Email sent successfully') {
                                                $http({
                                                    method: 'POST',
                                                    url: '/input-and-encrypt',
                                                    data: { name: $scope.name, age: $scope.age, gender: $scope.gender, license: $scope.license, keyName: $scope.keyName }
                                                })
                                                    .then(function (encryptRes) {
                                                        if (encryptRes.data.encryptedData) {
                                                            toastService.Notify("Data added securely on the Blockchain. Check your mail for further details!");
                                                        }
                                                    })
                                            }
                                        })
                                }
                            })

                    }
                })
        }
    }

})();
