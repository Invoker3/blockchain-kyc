(function () {
  angular
    .module('MyBlockchain')
    .controller('viewKYCCtrl', viewKYCCtrl)

  function viewKYCCtrl($scope, $mdDialog, dataToPass, $http) {
    var self = this;
    $scope.mdDialogData = dataToPass;
    console.log($scope.mdDialogData);

    $scope.viewInfo = function () {
      $http({
        method: 'POST',
        url: '/decrypt-and-output',
        data: { encryptedData: $scope.mdDialogData.encryptedData, servicePrivKey: $scope.servicePrivKey }
      })
        .then(function (viewRes) {
          $scope.viewFlag = true;
          console.log(viewRes.data);
          $scope.decryptedData = viewRes.data.decryptedData;
        })
    }

    $scope.cancel = function () {
      $mdDialog.hide();
    };
  }
})();

