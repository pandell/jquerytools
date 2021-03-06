/**
 * @license
 * jQuery Tools @VERSION Overlay - Overlay base. Extend it.
 *
 * NO COPYRIGHTS OR LICENSES. DO WHAT YOU LIKE.
 *
 * http://flowplayer.org/tools/overlay/
 *
 * Since: March 2008
 * Date: @DATE
 */

/*global jQuery: false */
/*jslint browser: true, vars: true, white: true */

(function($) {
    "use strict";

    var instances = [], effects = {};

    // static constructs
    $.tools = $.tools || {version: '@VERSION'};

    $.tools.overlay = {

        addEffect: function(name, loadFn, closeFn) {
            effects[name] = [loadFn, closeFn];
        },

        conf: {
            close: null,
            closeOnClick: true,
            closeOnEsc: true,
            closeSpeed: 'fast',
            effect: 'default',

            // since 1.2. fixed positioning not supported by IE6
            fixed: (document.documentMode || 100) > 6,

            left: 'center',
            load: false, // 1.2
            mask: null,
            oneInstance: true,
            speed: 'normal',
            target: null, // target element to be overlayed. by default taken from [rel]
            top: '10%'
        }
    };


    // the default effect. nice and easy!
    $.tools.overlay.addEffect('default',

        /*
            onLoad/onClose functions must be called otherwise none of the
            user supplied callback methods won't be called
        */
        function(pos, onLoad) {

            var conf = this.getConf(),
                 w = $(window);

            if (!conf.fixed)  {
                pos.top += w.scrollTop();
                pos.left += w.scrollLeft();
            }

            pos.position = conf.fixed ? 'fixed' : 'absolute';

            // milang, 2014-01-28: when using jquery.animate-enhanced.js with jquery 1.11,
            // fade* is resetting top/left position of overlay element; if we set "leaveTransforms"
            // to true, this is not happening
            // this.getOverlay().css(pos).fadeIn(conf.speed, onLoad);
            this.getOverlay().css(pos).animate({ opacity: "show", leaveTransforms: true }, conf.speed, onLoad);

        }, function(onClose) {
            // this.getOverlay().fadeOut(this.getConf().closeSpeed, onClose);
            this.getOverlay().animate({ opacity: "hide", leaveTransforms: true }, this.getConf().closeSpeed, onClose);
        }
    );


    function Overlay(trigger, conf) {

        // private variables
        var self = this,
            fire = trigger.add(self),
            w = $(window),
            closers,
            overlay,
            opened,
            maskConf = $.tools.expose && (conf.mask || conf.expose),
            uid = Math.random().toString().slice(10);


        // mask configuration
        if (maskConf) {
            if (typeof maskConf === 'string') { maskConf = {color: maskConf}; }
            maskConf.closeOnClick = maskConf.closeOnEsc = false;
        }

        // get overlay and trigger
        var jq = conf.target || trigger.attr("rel") || trigger;
        overlay = $(jq);
        if (!overlay.length) { throw "Could not find Overlay: " + jq; }

        // trigger's click event
        if (trigger && trigger.index(overlay) === -1) {
            trigger.click(function(e) {
                self.load(e);
                return e.preventDefault();
            });
        }

        // API methods
        $.extend(self, {

            load: function(e) {

                // can be opened only once
                if (self.isOpened()) { return self; }

                // find the effect
                var eff = effects[conf.effect];
                if (!eff) { throw "Overlay: cannot find effect : \"" + conf.effect + "\""; }

                // close other instances?
                if (conf.oneInstance) {
                    $.each(instances, function() {
                        this.close(e);
                    });
                }

                // onBeforeLoad
                e = e || $.Event();
                e.type = "onBeforeLoad";
                fire.trigger(e);
                if (e.isDefaultPrevented()) { return self; }

                // opened
                opened = true;

                // possible mask effect
                if (maskConf) { $(overlay).expose(maskConf); }

                // position & dimensions
                var top = conf.top;
                if (typeof top === 'string')  {
                    if (top === 'center') {
                        var oHeight = overlay.outerHeight(true);
                        top = Math.round(Math.max((w.height() - oHeight) / 2, 0));
                    } else { // treat as percentage
                        top = Math.round(parseInt(top, 10) * w.height() / 100);
                    }
                }

                var left = conf.left;
                if (typeof left === 'string') {
                    if (left === 'center') {
                        var oWidth = overlay.outerWidth(true);
                        left = Math.round(Math.max((w.width() - oWidth) / 2, 0));
                    } else { // treat as percentage
                        left = Math.round(parseInt(left, 10) * w.width() / 100);
                    }
                }


                // load effect
                eff[0].call(self, {top: top, left: left}, function() {
                    if (opened) {
                        e.type = "onLoad";
                        fire.trigger(e);
                    }
                });

                // mask.click closes overlay
                if (maskConf && conf.closeOnClick) {
                    $.mask.getMask().one("click", self.close);
                }

                // when window is clicked outside overlay, we close
                if (conf.closeOnClick) {
                    $(document).on("click." + uid, function(e) {
                        if (!$(e.target).parents(overlay).length) {
                            self.close(e);
                        }
                    });
                }

                // keyboard::escape
                if (conf.closeOnEsc) {

                    // one callback is enough if multiple instances are loaded simultaneously
                    $(document).on("keydown." + uid, function(e) {
                        if (e.keyCode === 27) {
                            self.close(e);
                        }
                    });
                }


                return self;
            },

            close: function(e) {

                if (!self.isOpened()) { return self; }

                e = e || $.Event();
                e.type = "onBeforeClose";
                fire.trigger(e);
                if (e.isDefaultPrevented()) { return; }

                opened = false;

                // close effect
                effects[conf.effect][1].call(self, function() {
                    e.type = "onClose";
                    fire.trigger(e);
                });

                // unbind the keyboard / clicking actions
                $(document).off("click." + uid + " keydown." + uid);

                if (maskConf) {
                    $.mask.close();
                }

                return self;
            },

            getOverlay: function() {
                return overlay;
            },

            getTrigger: function() {
                return trigger;
            },

            getClosers: function() {
                return closers;
            },

            isOpened: function()  {
                return opened;
            },

            // manipulate start, finish and speeds
            getConf: function() {
                return conf;
            }

        });

        // callbacks
        $.each(["onBeforeLoad", "onStart", "onLoad", "onBeforeClose", "onClose"], function () {

            // configuration
            var name = this;
            if ($.isFunction(conf[name])) {
                $(self).on(name, conf[name]);
            }

            // API
            self[name] = function(fn) {
                if (fn) { $(self).on(name, fn); }
                return self;
            };
        });

        // close button
        closers = overlay.find(conf.close || ".close");

        if (!closers.length && !conf.close) {
            closers = $('<a class="close"></a>');
            overlay.prepend(closers);
        }

        closers.click(function(e) {
            self.close(e);
        });

        // autoload
        if (conf.load) { self.load(); }

    }

    // jQuery plugin initialization
    $.fn.overlay = function(conf) {

        // already constructed --> return API
        var el = this.data("overlay");
        if (el) { return el; }

        if ($.isFunction(conf)) {
            conf = {onBeforeLoad: conf};
        }

        conf = $.extend(true, {}, $.tools.overlay.conf, conf);

        this.each(function() {
            el = new Overlay($(this), conf);
            instances.push(el);
            $(this).data("overlay", el);
        });

        return conf.api ? el: this;
    };

}(jQuery));
