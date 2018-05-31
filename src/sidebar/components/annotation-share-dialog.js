'use strict';

var angular = require('angular');
var scopeTimeout = require('../util/scope-timeout');

var annotationMetadata = require('../annotation-metadata');
var memoize = require('../util/memoize');

// @ngInject
function AnnotationShareDialogController($element, $scope, analytics, session, store) {
  var self = this;
  var shareLinkInput = $element.find('input')[0];


  $scope.$watch('vm.isOpen', function (isOpen) {
    if (isOpen) {
      // Focus the input and select it once the dialog has become visible
      scopeTimeout($scope, function () {
        shareLinkInput.focus();
        shareLinkInput.select();
      });
    }
  });

  this.copyToClipboard = function (event) {
    var $container = angular.element(event.currentTarget).parent();
    var shareLinkInput = $container.find('input')[0];

    try {
      shareLinkInput.select();

      // In some browsers, execCommand() returns false if it fails,
      // in others, it may throw an exception instead.
      if (!document.execCommand('copy')) {
        throw new Error('Copying link failed');
      }

      self.copyToClipboardMessage = 'Link copied to clipboard!';
    } catch (ex) {
      self.copyToClipboardMessage = 'Select and copy to share.';
    } finally {
      setTimeout(function () {
        self.copyToClipboardMessage = null;
        $scope.$digest();
      }, 1000);
    }
  };

  this.onShareClick = function(target){
    if(target){
      analytics.track(analytics.events.ANNOTATION_SHARED, target);
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

  function shareDiscussion(authCode,infos) {
    var xhr = new XMLHttpRequest();
    var url = "https://plazza.orange.com/api/core/v3/contents";
    xhr.open("POST", url, true);
    xhr.setRequestHeader("Content-type", "application/json");
    xhr.setRequestHeader("Authorization", "Basic " +authCode );
    xhr.setRequestHeader("X-JCAPI-Token", "S7xYd4UO");
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4 && xhr.status === 201) {
        alert("Publié sur Plazza avec succés");
        window.location.reload();
      } else {
        console.log('text err '+xhr.responseText);
      }
    };
    var content = "<body>"+
                  "<p><h2>"+infos.title+"</h2></p>"+
                  "<p><b>Tags : </b>"+infos.tags+
                  "</p>"+
                  "<p><b>Publié sur : </b><a href="+infos.uri+" target='_blanck'>"+infos.uri+"</a></p>"+
                  "</body>"
    var discussion = { "content": { "type": "text/html", "text": content },
      "subject": "Discussion depuis Annotons nos contenus",
      "type": "discussion"
    };
    var data = JSON.stringify(discussion);
    xhr.send(data);
  }

  this.onSharePlazza = function () {
    var uri = this.uri;
    var fields = uri.split('/a/');
    var annotation_id = fields[1];
    var infos = {};
    store.annotation.get({ id: annotation_id }).then(function (annot) {
      infos.title = annot.title;
      infos.uri = annot.uri;
      infos.tags=[];
      for (var i = 0; i < annot.tags.length; i++) {
        infos.tags.push(" "+annot.tags[i]+" ");
      }
      checkAuthenticated(function (data) {
        //traitement post
        if(data!='err'){
          shareDiscussion(data.password,infos);
        }else{
          console.log('error');
        }
      });
    });
  };
}

module.exports = {
  controller: AnnotationShareDialogController,
  controllerAs: 'vm',
  bindings: {
    annotation: '<',
    group: '<',
    uri: '<',
    isPrivate: '<',
    isOpen: '<',
    onClose: '&',
  },
  template: require('../templates/annotation-share-dialog.html'),
};
