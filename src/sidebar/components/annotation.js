'use strict';

var annotationMetadata = require('../annotation-metadata');
var events = require('../events');
var { isThirdPartyUser } = require('../util/account-id');
var tags = require('../tags').store;

var isNew = annotationMetadata.isNew;
var isReply = annotationMetadata.isReply;
var isPageNote = annotationMetadata.isPageNote;
var allAnnotations = [];

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
    rate: changes.rate,
    permissions: changes.isPrivate ?
      permissions.private(userid) : permissions.shared(userid, annotation.group),
  });
}

function addAnnotation(annotation) {
  if (annotation.title != undefined) {
    var existe = false;
    if (allAnnotations.length == 0) {
      allAnnotations.push(annotation);
    } else {
      for (var i = 0; i < allAnnotations.length; i++) {
        if (JSON.stringify(allAnnotations[i]) === JSON.stringify(annotation)) {
          existe = true;
          break;
        }
      }
      if (!existe) {
        allAnnotations.push(annotation);
      }
    }
  }
}

function updateTitle(annot) {
  console.log("all " + JSON.stringify(allAnnotations));
  for (var i = 0; i < allAnnotations.length; i++) {
    if (allAnnotations[i].title != annot.title) {
      allAnnotations[i].title = annot.title;
      return allAnnotations[i];
    }
  }
  return "notExist";
}

// @ngInject
function AnnotationController(
  $document, $rootScope, $scope, $timeout, $window, $element, analytics, annotationUI,
  annotationMapper, drafts, flash, groups, permissions, serviceUrl,
  session, settings, store, streamer) {

  var self = this;
  addAnnotation(self.annotation);

  var newlyCreatedByHighlightButton;

  this.getLastTitle = function () {
    if (allAnnotations.length == 0) {
      return self.annotation.document.title;
    } else {
      return allAnnotations[0].title;
    }
  };

  /** Save an annotation to the server. */
  function save(annot) {
    console.log("annot "+JSON.stringify(annot));
    var saved;
    var updating = !!annot.id;
    
    
    if (annot.title == "") {
      if (allAnnotations.length == 0) {
        annot.title = annot.document.title;
      } else {
        annot.title = allAnnotations[0].title;
      }
    } else {
      var annotationUpdate = updateTitle(annot);
      if (annotationUpdate != "notExist") {
        save(annotationUpdate);
      }
    }

    if (updating) {
      saved = store.annotation.update({id: annot.id}, annot);
    } else {
      saved = store.annotation.create({}, annot);
    }

    console.log(saved);

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


      if(self.isReply()){
        event = updating ? analytics.events.REPLY_UPDATED : analytics.events.REPLY_CREATED;
      }else if(self.isHighlight()){
        event = updating ? analytics.events.HIGHLIGHT_UPDATED : analytics.events.HIGHLIGHT_CREATED;
      }else if(isPageNote(self.annotation)) {
        event = updating ? analytics.events.PAGE_NOTE_UPDATED : analytics.events.PAGE_NOTE_CREATED;
      }else {
        event = updating ? analytics.events.ANNOTATION_UPDATED : analytics.events.ANNOTATION_CREATED;
      }

      analytics.track(event);

      return savedAnnot;
    });
  }

  /**
    * Initialize the controller instance.
    *
    * All initialization code except for assigning the controller instance's
    * methods goes here.
    */
  function init() {
    /** Determines whether controls to expand/collapse the annotation body
     * are displayed adjacent to the tags field.
     */
    self.canCollapseBody = false;

    /** Determines whether the annotation body should be collapsed. */
    self.collapseBody = true;

    /** True if the annotation is currently being saved. */
    self.isSaving = false;

    /** True if the 'Share' dialog for this annotation is currently open. */
    self.showShareDialog = false;

    /**
      * `true` if this AnnotationController instance was created as a result of
      * the highlight button being clicked.
      *
      * `false` if the annotation button was clicked, or if this is a highlight
      * or annotation that was fetched from the server (as opposed to created
      * new client-side).
      */
    newlyCreatedByHighlightButton = self.annotation.$highlight || false;

    // New annotations (just created locally by the client, rather then
    // received from the server) have some fields missing. Add them.
    //
    // FIXME: This logic should go in the `addAnnotations` Redux action once all
    // required state is in the store.
    self.annotation.user = self.annotation.user || session.state.userid;
    self.annotation.user_info = self.annotation.user_info || session.state.user_info;
    self.annotation.group = self.annotation.group || groups.focused().id;
    if (!self.annotation.permissions) {
      self.annotation.permissions = permissions.default(self.annotation.user,
                                                      self.annotation.group);
    }
    self.annotation.text = self.annotation.text || '';
    self.annotation.title = self.annotation.title || '';
    self.annotation.complexite = self.annotation.complexite || '';
    self.annotation.fraicheur = self.annotation.fraicheur || '';
    self.annotation.rate = self.annotation.rate || '';
    if (!Array.isArray(self.annotation.tags)) {
      self.annotation.tags = [];
    }
    if (!Array.isArray(self.annotation.typesContenu)) {
      self.annotation.typesContenu = [];
    }

    // Automatically save new highlights to the server when they're created.
    // Note that this line also gets called when the user logs in (since
    // AnnotationController instances are re-created on login) so serves to
    // automatically save highlights that were created while logged out when you
    // log in.
    saveNewHighlight();

    // If this annotation is not a highlight and if it's new (has just been
    // created by the annotate button) or it has edits not yet saved to the
    // server - then open the editor on AnnotationController instantiation.
    if (!newlyCreatedByHighlightButton) {
      if (isNew(self.annotation) || drafts.get(self.annotation)) {
        self.edit();
      }
    }
  }

  /** Save this annotation if it's a new highlight.
   *
   * The highlight will be saved to the server if the user is logged in,
   * saved to drafts if they aren't.
   *
   * If the annotation is not new (it has already been saved to the server) or
   * is not a highlight then nothing will happen.
   *
   */
  function saveNewHighlight() {
    if (!isNew(self.annotation)) {
      // Already saved.
      return;
    }

    if (!self.isHighlight()) {
      // Not a highlight,
      return;
    }

    if (self.annotation.user) {
      // User is logged in, save to server.
      // Highlights are always private.
      self.annotation.permissions = permissions.private(self.annotation.user);
      save(self.annotation).then(function(model) {
        model.$tag = self.annotation.$tag;
        $rootScope.$broadcast(events.ANNOTATION_CREATED, model);
      });
    } else {
      // User isn't logged in, save to drafts.
      drafts.update(self.annotation, self.state());
    }
  }

  this.authorize = function(action) {
    return permissions.permits(
      self.annotation.permissions,
      action,
      session.state.userid
    );
  };

  /**
    * @ngdoc method
    * @name annotation.AnnotationController#flag
    * @description Flag the annotation.
    */
  this.flag = function() {
    if (!session.state.userid) {
      flash.error(
        'You must be logged in to report an annotation to the moderators.',
        'Login to flag annotations'
      );
      return;
    }

    var onRejected = function(err) {
      flash.error(err.message, 'Flagging annotation failed');
    };
    annotationMapper.flagAnnotation(self.annotation).then(function(){
      analytics.track(analytics.events.ANNOTATION_FLAGGED);
      annotationUI.updateFlagStatus(self.annotation.id, true);
    }, onRejected);
  };

  /**
    * @ngdoc method
    * @name annotation.AnnotationController#delete
    * @description Deletes the annotation.
    */
  this.delete = function() {
    return $timeout(function() {  // Don't use confirm inside the digest cycle.
      var msg = 'Are you sure you want to delete this annotation?';
      if ($window.confirm(msg)) {
        var onRejected = function(err) {
          flash.error(err.message, 'Deleting annotation failed');
        };
        $scope.$apply(function() {
          annotationMapper.deleteAnnotation(self.annotation).then(function(){
            var event;

            if(self.isReply()){
              event = analytics.events.REPLY_DELETED;
            }else if(self.isHighlight()){
              event = analytics.events.HIGHLIGHT_DELETED;
            }else if(isPageNote(self.annotation)){
              event = analytics.events.PAGE_NOTE_DELETED;
            }else {
              event = analytics.events.ANNOTATION_DELETED;
            }

            analytics.track(event);

          }, onRejected);
        });
      }
    }, true);
  };

  /**
    * @ngdoc method
    * @name annotation.AnnotationController#edit
    * @description Switches the view to an editor.
    */
  this.edit = function() {

    if (!drafts.get(self.annotation)) {
      drafts.update(self.annotation, self.state());
    }

  };

  /**
   * @ngdoc method
   * @name annotation.AnnotationController#editing.
   * @returns {boolean} `true` if this annotation is currently being edited
   *   (i.e. the annotation editor form should be open), `false` otherwise.
   */
  this.editing = function() {
	  for (var i=1; i<=5; i++){
          var element = angular.element(document.querySelector('.id'+this.annotation.id+'rating'+i));
          //console.log(element);
	   if(i<=self.state().rate){
	   element.addClass('rating_selected');
	   }else{
	   element.removeClass('rating_selected');
	   }
	  }

    return drafts.get(self.annotation) && !self.isSaving;
  };

  /**
    * @ngdoc method
    * @name annotation.AnnotationController#group.
    * @returns {Object} The full group object associated with the annotation.
    */
  this.group = function() {
    return groups.get(self.annotation.group);
  };

  /**
    * @ngdoc method
    * @name annotation.AnnotaitonController#hasContent
    * @returns {boolean} `true` if this annotation has content, `false`
    *   otherwise.
    */
  this.hasContent = function() {
    return self.state().text.length > 0 || self.state().tags.length > 0;
  };

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

  this.id = function() {
    return self.annotation.id;
  };

  this.rating = function(rate){
          console.log(rate);
	  if(this.annotation.id==undefined){

	  for (var i=1; i<=5; i++){
          var element = angular.element(document.querySelector('.idrating'+i));
          //console.log(element);
	   if(i<=rate){
	   element.addClass('rating_selected');
	   }else{
	   element.removeClass('rating_selected');
	   }
	  }

	  }else{

	  for (var i=1; i<=5; i++){
          var element = angular.element(document.querySelector('.id'+this.annotation.id+'rating'+i));
          //console.log(element);
	   if(i<=rate){
	   element.addClass('rating_selected');
	   }else{
	   element.removeClass('rating_selected');
	   }
	  }

	  }

	drafts.update(self.annotation, {
          isPrivate: self.state().isPrivate,
          tags: self.state().tags,
          text: self.state().text,
          title: self.state().title,
	  complexite: self.state().complexite,
	  fraicheur: self.state().fraicheur,
          typesContenu: self.state().typesContenu,
          rate: rate,
    });
  }

function getThreadHeight(id) {
  var threadElement = document.getElementById(id);
  if (!threadElement) {
    return null;
  }

  // Note: `getComputedStyle` may return `null` in Firefox if the iframe is
  // hidden. See https://bugzilla.mozilla.org/show_bug.cgi?id=548397
  var style = window.getComputedStyle(threadElement);
  if (!style) {
    return null;
  }

  // Get the height of the element inside the border-box, excluding
  // top and bottom margins.
  var elementHeight = threadElement.getBoundingClientRect().height;

  // Get the bottom margin of the element. style.margin{Side} will return
  // values of the form 'Npx', from which we extract 'N'.
  var marginHeight = parseFloat(style.marginTop) +
                     parseFloat(style.marginBottom);

  return elementHeight + marginHeight;
}

function changeHeight(id){
   var element = angular.element(document.querySelector('.actions'+id));
   var element_button = angular.element(document.querySelector('.actions'+id+' .annotation-action-btn'));

   if(element[0].style.display == "block"){
         var height = getThreadHeight(id);
         height = height - 50;
 	 element_button[0].style.marginTop = '';
         if(height<200){
	 element_button[0].style.marginTop = '50px';
	 }else{
	 element_button[0].style.marginTop = '120px';
	 }
         var margin = (-(height) -30);
	 element[0].style.height = '';
	 element[0].style.height = `${height}px`;
	 element[0].style.marginTop = '';
	 element[0].style.marginTop = `${margin}px`;	 
   }
}

   this.plusCommentaire = function(id){
   var element_commentaire;
	if(id==undefined){
         element_commentaire = angular.element(document.querySelector('.Commentaire'));
 	 if(element_commentaire[0].style.display == "none"){
	 element_commentaire[0].style.display = "block";
	 }else{
	 element_commentaire[0].style.display = "none";
	 }
	}else{
        element_commentaire = angular.element(document.querySelector('.Commentaire'+id));
 	if(element_commentaire[0].style.display == "none"){
	element_commentaire[0].style.display = "block";
	}else{
	element_commentaire[0].style.display = "none";
	}
	}

  /* var plus_commentaire;

        plus_commentaire = angular.element(document.querySelector('.plusCommentaire'));
	console.log('plus_commentaire'+Object.keys(plus_commentaire[0]));
 	if(plus_commentaire[0].innerHTML == "Afficher Plus"){
	plus_commentaire[0].innerHTML = "Afficher Moins";
	}else{
	plus_commentaire[0].innerHTML= "Afficher Plus";
	}*/
	
   changeHeight(id);
	}

   this.plusInfo = function(id){
   var element;
	if(id==undefined){
         element = angular.element(document.querySelector('.infos'));
 	 if(element[0].style.display == "none"){
	 element[0].style.display = "block";
	 }else{
	 element[0].style.display = "none";
	 }
	}else{
        element = angular.element(document.querySelector('.infos'+id));
 	if(element[0].style.display == "none"){
	element[0].style.display = "block";
	}else{
	element[0].style.display = "none";
	}
	}
   changeHeight(id);
	}


   this.actions = function(id){
   var element;
	if(id==undefined){
         element = angular.element(document.querySelector('.actions'));
 	 if(element[0].style.display == "none"){
	 element[0].style.display = "block";
	 }else{
	 element[0].style.display = "none";
	 }
	}else{
        element = angular.element(document.querySelector('.actions'+id));
 	if(element[0].style.display == "none"){
	element[0].style.display = "block";
   	changeHeight(id);
	}else{
	element[0].style.display = "none";
	}
	}
	}


  /**
    * @ngdoc method
    * @name annotation.AnnotationController#isHighlight.
    * @returns {boolean} true if the annotation is a highlight, false otherwise
    */
  this.isHighlight = function() {
    if (newlyCreatedByHighlightButton) {
      return true;
    } else if (isNew(self.annotation)) {
      return false;
    } else {
      // Once an annotation has been saved to the server there's no longer a
      // simple property that says whether it's a highlight or not. Instead an
      // annotation is considered a highlight if it has a) content and b) is
      // linked to a specific part of the document.
      if (isPageNote(self.annotation) || isReply(self.annotation)) {
        return false;
      }
      if (self.annotation.hidden) {
        // Annotation has been censored so we have to assume that it had
        // content.
        return false;
      }
      return !self.hasContent();
    }
  };

  /**
    * @ngdoc method
    * @name annotation.AnnotationController#isShared
    * @returns {boolean} True if the annotation is shared (either with the
    * current group or with everyone).
    */
  this.isShared = function() {
    return !self.state().isPrivate;
  };

  // Save on Meta + Enter or Ctrl + Enter.
  this.onKeydown = function (event) {
    if (event.keyCode === 13 && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      self.save();
    }
  };

  this.toggleCollapseBody = function(event) {
    event.stopPropagation();
    self.collapseBody = !self.collapseBody;
  };

  /**
    * @ngdoc method
    * @name annotation.AnnotationController#reply
    * @description
    * Creates a new message in reply to this annotation.
    */
  this.reply = function() {
    var references = (self.annotation.references || []).concat(self.annotation.id);
    var group = self.annotation.group;
    var replyPermissions;
    var userid = session.state.userid;
    if (userid) {
      replyPermissions = self.state().isPrivate ?
        permissions.private(userid) : permissions.shared(userid, group);
    }
    annotationMapper.createAnnotation({
      group: group,
      references: references,
      permissions: replyPermissions,
      target: [{source: self.annotation.target[0].source}],
      uri: self.annotation.uri,
    });
  };

  /**
    * @ngdoc method
    * @name annotation.AnnotationController#revert
    * @description Reverts an edit in progress and returns to the viewer.
    */
  this.revert = function() {
    drafts.remove(self.annotation);
    if (isNew(self.annotation)) {
      $rootScope.$broadcast(events.ANNOTATION_DELETED, self.annotation);
    }
  };

  this.save = function() {
    if (!self.annotation.user) {
      flash.info('Please log in to save your annotations.');
      return Promise.resolve();
    }
    /*if (!self.hasContent() && self.isShared()) {
      flash.info('Please add text or a tag before publishing.');
      return Promise.resolve();
    }*/

   //console.log("state save anno"+JSON.stringify(self.state()));
    var updatedModel = updateModel(self.annotation, self.state(), permissions);
    //console.log("updatedModel "+JSON.stringify(updatedModel));
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
      self.edit();
      flash.error(err.message, 'Saving annotation failed');
    });
  };

  /**
    * @ngdoc method
    * @name annotation.AnnotationController#setPrivacy
    *
    * Set the privacy settings on the annotation to a predefined
    * level. The supported levels are 'private' which makes the annotation
    * visible only to its creator and 'shared' which makes the annotation
    * visible to everyone in the group.
    *
    * The changes take effect when the annotation is saved
    */
  this.setPrivacy = function(privacy) {
    // When the user changes the privacy level of an annotation they're
    // creating or editing, we cache that and use the same privacy level the
    // next time they create an annotation.
    // But _don't_ cache it when they change the privacy level of a reply.
    if (!isReply(self.annotation)) {
      permissions.setDefault(privacy);
    }
    drafts.update(self.annotation, {
      tags: self.state().tags,
      text: self.state().text,
      isPrivate: privacy === 'private',
      title: self.state().title,
      complexite: self.state().complexite,
      fraicheur: self.state().fraicheur,
      typesContenu: self.state().typesContenu,
      rate: self.state().rate,
    });
  };

  this.tagSearchURL = function(tag) {
    if (this.isThirdPartyUser()) {
      return null;
    }
    //console.log("Annotation search by tag")
    return serviceUrl('search.tag', {tag: tag});
  };

  this.isOrphan = function() {
    if (typeof self.annotation.$orphan === 'undefined') {
      return self.annotation.$anchorTimeout;
    }
    return self.annotation.$orphan;
  };

  this.user = function() {
    return self.annotation.user;
  };

  this.isThirdPartyUser = function () {
    return isThirdPartyUser(self.annotation.user, settings.authDomain);
  };

  this.isDeleted = function () {
    return streamer.hasPendingDeletion(self.annotation.id);
  };

  this.isHiddenByModerator = function () {
    return self.annotation.hidden;
  };

  this.canFlag = function () {
    // Users can flag any annotations except their own.
    return session.state.userid !== self.annotation.user;
  };

  this.isFlagged = function() {
    return self.annotation.flagged;
  };

  this.isReply = function () {
    return isReply(self.annotation);
  };

  this.incontextLink = function () {
    if (self.annotation.links) {
      return self.annotation.links.incontext ||
             self.annotation.links.html ||
             '';
    }
    return '';
  };

  /**
   * Sets whether or not the controls for expanding/collapsing the body of
   * lengthy annotations should be shown.
   */
  this.setBodyCollapsible = function (canCollapse) {
    if (canCollapse === self.canCollapseBody) {
      return;
    }
    self.canCollapseBody = canCollapse;

    // This event handler is called from outside the digest cycle, so
    // explicitly trigger a digest.
    $scope.$digest();
  };


   //TypeContenu Section
   //var allTypesContenu = this.allTypesContenu;
   this.setTypesContenu = function(typeContenu){

     //var existe = false;
     //var index;
     console.log('self.state().typesContenu begin = '+self.state().typesContenu)
     if (typeof self.state().typesContenu[0] !== 'undefined' && self.state().typesContenu[0] !== null) { 
		self.state().typesContenu[0] = typeContenu;
    }else{
        self.state().typesContenu.push(typeContenu);
    }
	console.log('self.state().typesContenu end = '+self.state().typesContenu)

	drafts.update(self.annotation, {
          isPrivate: self.state().isPrivate,
          tags: self.state().tags,
          text: self.state().text,
          title: self.state().title,
	  complexite: self.state().complexite,
	  fraicheur: self.state().fraicheur,
          typesContenu: self.state().typesContenu,
          rate: self.state().rate,

    });
   };

   this.setComplexite = function(complexite){
     //console.log("here complexite "+complexite);
	drafts.update(self.annotation, {
          isPrivate: self.state().isPrivate,
          tags: self.state().tags,
          text: self.state().text,
          title: self.state().title,
	  complexite: complexite,
	  fraicheur: self.state().fraicheur,
          typesContenu: self.state().typesContenu,
          rate: self.state().rate,

    });
   };

  this.setTitle = function (title) {
  
//console.log(title);
    drafts.update(self.annotation, {
      isPrivate: self.state().isPrivate,
      tags: self.state().tags,
      text: self.state().text,
      title: title,
      complexite: self.state().complexite,
      fraicheur: self.state().fraicheur,
      typesContenu: self.state().typesContenu,
      rate: self.state().rate,
    });
  };

  this.setFraicheur = function (fraicheur) {
//console.log(fraicheur);
    drafts.update(self.annotation, {
      isPrivate: self.state().isPrivate,
      tags: self.state().tags,
      text: self.state().text,
      title: self.state().title,
      complexite: self.state().complexite,
      fraicheur: fraicheur,
      typesContenu: self.state().typesContenu,
      rate: self.state().rate,
    });
  };


  this.setText = function (text) {
    drafts.update(self.annotation, {
      isPrivate: self.state().isPrivate,
      tags: self.state().tags,
      text: text,
      title: self.state().title,
      complexite: self.state().complexite,
      fraicheur: self.state().fraicheur,
      typesContenu: self.state().typesContenu,
      rate: self.state().rate,
    });
  };

  this.setTags = function (tags) {
//console.log("here tags "+JSON.stringify(tags));
    drafts.update(self.annotation, {
      isPrivate: self.state().isPrivate,
      tags: tags,
      text: self.state().text,
      title: self.state().title,
      complexite: self.state().complexite,
      fraicheur: self.state().fraicheur,
      typesContenu: self.state().typesContenu,
      rate: self.state().rate,
    });
  };

  this.state = function () {
    var draft = drafts.get(self.annotation);
    if (draft) {
      return draft;
    }
	  for (var i=1; i<=5; i++){
          var element = angular.element(document.querySelector('.id'+this.annotation.id+'rating'+i));
          //console.log(element);
	   if(i<=self.annotation.rate){
	   element.addClass('rating_selected');
	   }else{
	   element.removeClass('rating_selected');
	   }
	  }
    return {
      tags: self.annotation.tags,
      text: self.annotation.text,
      title: self.annotation.title,
      complexite: self.annotation.complexite,
      fraicheur: self.annotation.fraicheur,
      typesContenu: self.annotation.typesContenu,
      rate: self.annotation.rate,
      isPrivate: !permissions.isShared(self.annotation.permissions,
                                       self.annotation.user),
    };
  };

  /**
   * Return true if the CC 0 license notice should be shown beneath the
   * annotation body.
   */
  this.shouldShowLicense = function () {
    if (!self.editing() || !self.isShared()) {
      return false;
    }
    return self.group().public;
  };

  init();
}

module.exports = {
  controller: AnnotationController,
  controllerAs: 'vm',
  bindings: {
    annotation: '<',
    showDocumentInfo: '<',
    onReplyCountClick: '&',
    replyCount: '<',
    isCollapsed: '<',
    auth: '<',
  },
  template: require('../templates/annotation.html'),

  // Private helper exposed for use in unit tests.
  updateModel: updateModel,
};
