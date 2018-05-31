'use strict';

var VIA_PREFIX = 'https://via.hypothes.is/';

// @ngInject
function ShareDialogController($scope, $element, analytics, annotationUI, session) {
  var self = this;

  function updateViaLink(frames) {
    if (!frames.length) {
      self.viaPageLink = '';
      return;
    }

    self.viaPageLink = frames[0].uri;
    /* Check to see if we are on a via page. If so, we just return the URI.
    if (frames[0].uri.indexOf(VIA_PREFIX) === 0) {
      self.viaPageLink = frames[0].uri;
    } else {
      self.viaPageLink = VIA_PREFIX + frames[0].uri;
    }*/
  }

  var viaInput = $element[0].querySelector('.js-via');
  viaInput.focus();
  viaInput.select();

  $scope.$watch(function () { return annotationUI.frames(); },
    updateViaLink);

  $scope.onShareClick = function(target){
    if(target){
      analytics.track(analytics.events.DOCUMENT_SHARED, target);
    }
  };

 function checkAuthenticated(callback) {
    var xhr = new XMLHttpRequest();
    var url = "https://10.241.109.147:5000/api/getuser/"+session.state.userid;
    xhr.open("GET", url, true);
    xhr.setRequestHeader("Content-type", "application/json");
    xhr.onreadystatechange = function () {
      if (xhr.status === 200 && xhr.readyState === 4) {
          var data = JSON.parse(xhr.responseText);
          console.log(data)
          callback(data);
      } else {
          callback('err');
      }
    };
    xhr.send();
  }

  this.onSharePlazza = function () {

    checkAuthenticated(function (data) {
        console.log("checkAuthenticated "+data)
        //traitement post
        if(data!='err'){
        var xhr = new XMLHttpRequest();
        var url = "https://plazza.orange.com/api/core/v3/contents";
        xhr.open("POST", url, true);
        xhr.setRequestHeader("Content-type", "application/json");
        xhr.setRequestHeader("Authorization", "Basic " +data.password);
        xhr.setRequestHeader("X-JCAPI-Token", "S7xYd4UO");
        xhr.onreadystatechange = function () {
          if (xhr.readyState === 4 && xhr.status === 201) {
              alert("Publié sur Plazza avec succés");
              window.location.reload();
          } else {
            console.log('text err ' + xhr.responseText);
          }
        };
        var discussion = { "content": { "type": "text/html", "text": "<body><h2>Discussion de Annotons</h2>"+
                           "<p><b>Lien de la page : </b><a href="+self.viaPageLink+" target='_blanck'>"+self.viaPageLink+"</a></p></body>" },
          "subject": "Discussion depuis Annotons nos contenus",
          "type": "discussion"
        };
        var data = JSON.stringify(discussion);
        xhr.send(data);
        }else{
          console.log('error');
        }
    });
  };

}

module.exports = {
  controller: ShareDialogController,
  controllerAs: 'vm',
  bindings: {
    onClose: '&',
  },
  template: require('../templates/share-dialog.html'),
};
