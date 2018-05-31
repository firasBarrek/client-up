'use strict';

var annotationMetadata = require('../annotation-metadata');
var memoize = require('../util/memoize');
var { isThirdPartyUser, username } = require('../util/account-id');
var annotations_id = [];
var runned = 0;


var events = require('../events');
var isNew = annotationMetadata.isNew;
var isReply = annotationMetadata.isReply;
var isPageNote = annotationMetadata.isPageNote;

/**
 * Return a copy of `annotation` with changes made in the editor applied.
 */
function updateModel(annotation, changes, permissions) {
  var userid = annotation.user;
  return Object.assign({}, annotation, {
    // Apply changes from the draft
    tags: changes.tags,
    text: changes.text,
    title: changes.title,
    complexite: changes.complexite,
    fraicheur: changes.fraicheur,
    rubriques: changes.rubriques,
    rate: changes.rate,
    permissions: changes.isPrivate ?
      permissions.private(userid) : permissions.shared(userid, annotation.group),
  });
}

function displayRate(arrayAnnotations){
        arrayAnnotations.forEach(function(data){
		//console.log(data.id+" && "+data.rate)
         if(data.rate!=""){
         for (var i=1; i<=5; i++){
	//console.log(annotation_id);
          var element = angular.element(document.querySelector('.id'+data.id+'rating'+i)); 
		//console.log(element);
	    if(i<=data.rate){
	    element.addClass('rating_selected');
	    }else{
	    element.removeClass('rating_selected');
	    }
	  }
	}
        });
}

function setAnnotations_id(id,rate){
  var existe = false;
  annotations_id.forEach(function(element){
	if(element==id){
	    	existe = true;
	}
   });
 if(!existe){
    annotations_id.push({"id":id,"rate":rate});
  }
}

function getAnnotations_id(){
  return annotations_id;
}

function setRunned(){

  runned = runned+1;
}

function getRunned(){
  return runned;
}

// @ngInject
function AnnotationHeaderController($document,features, groups, settings, serviceUrl,drafts,permissions,$rootScope,
			            analytics,store, $scope,flash) {
  var self = this;

    /** True if the annotation is currently being saved. */
    self.isSaving = false;
    //console.log('header annotations'+JSON.stringify(this.annotation));

setAnnotations_id(this.annotation.id,this.annotation.rate);
   
setTimeout(function(){
 setRunned();
 if(getRunned()==getAnnotations_id().length){
  displayRate(getAnnotations_id());
 }
}, 1000);

  this.user = function () {
    return self.annotation.user;
  };


  this.displayName = () => {
    var userInfo = this.annotation.user_info;
    var isThirdPartyUser_ = isThirdPartyUser(this.annotation.user, settings.authDomain);
    if (features.flagEnabled('client_display_names') || isThirdPartyUser_) {
      // userInfo is undefined if the api_render_user_info feature flag is off.
      if (userInfo) {
        // display_name is null if the user doesn't have a display name.
        if (userInfo.display_name) {
          return userInfo.display_name;
        }
      }
    }
    return username(this.annotation.user);
  };

  
    this.state = function () {
    var draft = drafts.get(self.annotation);
    if (draft) {
      return draft;
    }
    return {
      tags: self.annotation.tags,
      text: self.annotation.text,
      title: self.annotation.title,
      complexite: self.annotation.complexite,
      fraicheur: self.annotation.fraicheur,
      rubriques: self.annotation.rubriques,
      typesContenu: self.annotation.typesContenu,
      rate: self.annotation.rate,
      isPrivate: !permissions.isShared(self.annotation.permissions,
                                       self.annotation.user),
    };
  };

  this.isReply = function () {
    return isReply(self.annotation);
  };


  /** Save an annotation to the server. */
  function save(annot) {
    //console.log("annot "+JSON.stringify(annot));
    var saved;
    var updating = !!annot.id;

    if (updating) {
      saved = store.annotation.update({id: annot.id}, annot);
    } else {
      saved = store.annotation.create({}, annot);
    }

    return saved.then(function (savedAnnot) {

      var event;

      // Copy across internal properties which are not part of the annotation
      // model saved on the server
      savedAnnot.$tag = annot.$tag;
      Object.keys(annot).forEach(function (k) {
        if (k[0] === '$') {
          savedAnnot[k] = annot[k];
        }
      });

	console.log("savedAnnot"+JSON.stringify(savedAnnot));
      return savedAnnot;
    });
  }

  /**
    * Return the annotation's quote if it has one or `null` otherwise.
    */
  this.quote = function() {
    if (self.annotation.target.length === 0) {
      return null;
    }
    var target = self.annotation.target[0];
    if (!target.selector) {
      return null;
    }
    var quoteSel = target.selector.find(function (sel) {
      return sel.type === 'TextQuoteSelector';
    });
    return quoteSel ? quoteSel.exact : null;
  };

  this.save = function() {
   console.log("state save anno"+JSON.stringify(self.state()));
    var updatedModel = updateModel(self.annotation, self.state(), permissions);
    console.log("updatedModel "+JSON.stringify(updatedModel));
    // Optimistically switch back to view mode and display the saving
    // indicator
    self.isSaving = true;

    return save(updatedModel).then(function (model) {
      Object.assign(updatedModel, model);

      self.isSaving = false;

      var event = isNew(self.annotation) ?
        events.ANNOTATION_CREATED : events.ANNOTATION_UPDATED;
      drafts.remove(self.annotation);

      $rootScope.$broadcast(event, updatedModel);
    }).catch(function (err) {
      self.isSaving = false;
      flash.error(err.message, 'Saving annotation failed');
    });
  };


  this.rating = function(rate){

	  for (var i=1; i<=5; i++){
          var element = angular.element(document.querySelector('.id'+this.annotation.id+'rating'+i));
          //console.log(element);
	   if(i<=rate){
	   element.addClass('rating_selected');
	   }else{
	   element.removeClass('rating_selected');
	   }
	  }
        self.annotation.rate = rate;
	self.save(rate);
  }

  this.isThirdPartyUser = function () {
    return isThirdPartyUser(self.annotation.user, settings.authDomain);
  };

  this.thirdPartyUsernameLink = function () {
    return settings.usernameUrl ?
      settings.usernameUrl + username(this.annotation.user):
      null;
  };

  this.serviceUrl = serviceUrl;

  this.group = function () {
    return groups.get(self.annotation.group);
  };

  var documentMeta = memoize(annotationMetadata.domainAndTitle);
  this.documentMeta = function () {
    return documentMeta(self.annotation);
  };

  this.updated = function () {
    return self.annotation.updated;
  };

  this.htmlLink = function () {
    if (self.annotation.links && self.annotation.links.html) {
      return self.annotation.links.html;
    }
    return '';
  };
}

/**
 * Header component for an annotation card.
 *
 * Header which displays the username, last update timestamp and other key
 * metadata about an annotation.
 */
module.exports = {
  controller: AnnotationHeaderController,
  controllerAs: 'vm',
  bindings: {
    /**
     * The saved annotation
     */
    annotation: '<',

    /**
     * True if the annotation is private or will become private when the user
     * saves their changes.
     */
    isPrivate: '<',

    /** True if the user is currently editing the annotation. */
    isEditing: '<',

    /**
     * True if the annotation is a highlight.
     * FIXME: This should determined in AnnotationHeaderController
     */
    isHighlight: '<',
    onReplyCountClick: '&',
    replyCount: '<',

    /** True if document metadata should be shown. */
    showDocumentInfo: '<',
  },
  template: require('../templates/annotation-header.html'),
};
