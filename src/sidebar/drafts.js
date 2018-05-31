'use strict';

/**
 * Return true if a given `draft` is empty and can be discarded without losing
 * any user input
 */
function isEmpty(draft) {
  if (!draft) {
    return true;
  }
  return !draft.text && draft.tags.length === 0;
}

/**
 * The drafts service provides temporary storage for unsaved edits to new or
 * existing annotations.
 *
 * A draft consists of:
 *
 * 1. `model` which is the original annotation domain model object which the
 *    draft is associated with. Domain model objects are never returned from
 *    the drafts service, they're only used to identify the correct draft to
 *    return.
 *
 * 2. `isPrivate` (boolean), `tags` (array of objects) and `text` (string)
 *    which are the user's draft changes to the annotation. These are returned
 *    from the drafts service by `drafts.get()`.
 *
 */
function DraftStore() {
//console.log("here draft");
  this._drafts = [];

  /**
   * Returns true if 'draft' is a draft for a given
   * annotation.
   *
   * Annotations are matched by ID or local tag.
   */
  function match(draft, model) {
    return (draft.model.$tag && model.$tag === draft.model.$tag) ||
           (draft.model.id && model.id === draft.model.id);
  }

  /**
   * Returns the number of drafts - both unsaved new annotations, and unsaved
   * edits to saved annotations - currently stored.
   */
  this.count = function count() {
    return this._drafts.length;
  };

  /**
   * Returns a list of local tags of new annotations for which unsaved drafts
   * exist.
   *
   * @return {Array<{$tag: string}>}
   */
  this.unsaved = function unsaved() {
    return this._drafts.filter(function(draft) {
      return !draft.model.id;
    }).map(function(draft) {
      return draft.model;
    });
  };

  /** Retrieve the draft changes for an annotation. */
  this.get = function get(model) {
 //console.log("here get draft"+JSON.stringify(model));
    for (var i = 0; i < this._drafts.length; i++) {
      var draft = this._drafts[i];
      if (match(draft, model)) {
 //console.log("match "+JSON.stringify(draft));
        return {
          isPrivate: draft.isPrivate,
          tags: draft.tags,
          text: draft.text,
	  title: draft.title,
	  complexite: draft.complexite,
          fraicheur: draft.fraicheur,
	  rubriques: draft.rubriques,
          typesContenu: draft.typesContenu,
	  rate: draft.rate,
        };
      }
    }
    return null;
  };

  /**
   * Returns the draft changes for an annotation, or null if no draft exists
   * or the draft is empty.
   */
  this.getIfNotEmpty = function (model) {
    var draft = this.get(model);
    return isEmpty(draft) ? null : draft;
  };

  /**
   * Update the draft version for a given annotation, replacing any
   * existing draft.
   */
  this.update = function update(model, changes) {
  //console.log("update "+JSON.stringify(changes.rate));
    var newDraft = {
      model: {id: model.id, $tag: model.$tag},
      isPrivate: changes.isPrivate,
      tags: changes.tags,
      text: changes.text,
      title: changes.title,
      complexite: changes.complexite,
      fraicheur: changes.fraicheur,
      rubriques: changes.rubriques,
      typesContenu: changes.typesContenu,
      rate: changes.rate,
    };
    this.remove(model);
    this._drafts.push(newDraft);
  };

  /** Remove the draft version of an annotation. */
  this.remove = function remove(model) {
    this._drafts = this._drafts.filter(function(draft) {
      return !match(draft, model);
    });
  };

  /** Remove all drafts. */
  this.discard = function discard() {
    this._drafts = [];
  };
}

module.exports = function() {
  return new DraftStore();
};
