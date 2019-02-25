(function () {
    'use strict';
    angular
        .module('MyBlockchain')
        .service('toastService', toastService);

    function toastService($mdToast) {
        var service = {};
        service.Notify = function (msg) {
            $mdToast.show(
                $mdToast.simple()
                    .textContent(msg)
                    .position('left top')
                    .action('OK')
            );
        }

        return service;
    }
})();