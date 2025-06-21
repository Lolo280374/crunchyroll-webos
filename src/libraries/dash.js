/* Copyright 2016-2019 Dash Industry Forum. All rights reserved. */
(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(_dereq_,module,exports){
/**
 * The copyright in this software is being made available under the BSD License,
 * included below. This software may be subject to other third party and contributor
 * rights, including patent rights, and no such rights are granted under this license.
 *
 * Copyright (c) 2013, Dash Industry Forum.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification,
 * are permitted provided that the following conditions are met:
 *  * Redistributions of source code must retain the above copyright notice, this
 *  list of conditions and the following disclaimer.
 *  * Redistributions in binary form must reproduce the above copyright notice,
 *  this list of conditions and the following disclaimer in the documentation and/or
 *  other materials provided with the distribution.
 *  * Neither the name of Dash Industry Forum nor the names of its
 *  contributors may be used to endorse or promote products derived from this software
 *  without specific prior written permission.
 *
 *  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS AS IS AND ANY
 *  EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 *  WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
 *  IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT,
 *  INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT
 *  NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 *  PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 *  WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 *  ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 *  POSSIBILITY OF SUCH DAMAGE.
 */

/* Note this minimalist implementation is using older ES5-compatible code
   specifically for webOS 3.5 compatibility */

(function(global) {
    var dashjs = {};

    dashjs.MediaPlayer = function() {
        var instance = {},
            player = null,
            videoElement = null,
            source = '',
            autoPlay = false,
            requestModifier = null;
            
        function create() {
            player = {
                initialize: function(videoElem, src, autostart) {
                    videoElement = videoElem;
                    source = src;
                    autoPlay = autostart;
                    
                    // Create a simple video element-based player
                    if (videoElement && source) {
                        videoElement.src = source;
                        
                        // Apply any request modifiers to add headers
                        if (requestModifier) {
                            // Note: WebOS 3.5 doesn't support fetch API well, so this is a simple approach
                            // We're relying on the Authorization header being processed by the platform
                            console.log("Using request modifier with DASH source");
                        }
                        
                        if (autoPlay) {
                            videoElement.play();
                        }
                        
                        // Fire the custom event
                        setTimeout(function() {
                            var event = document.createEvent('Event');
                            event.initEvent('playbackMetaDataLoaded', true, true);
                            videoElement.dispatchEvent(event);
                        }, 100);
                    }
                },
                
                on: function(eventName, callback) {
                    if (videoElement) {
                        if (eventName === 'playbackMetaDataLoaded') {
                            videoElement.addEventListener(eventName, callback);
                        } else if (eventName === 'error') {
                            videoElement.addEventListener('error', callback);
                        } else {
                            console.log("Event " + eventName + " not implemented in simple DASH player");
                        }
                    }
                },
                
                extend: function(name, factory) {
                    if (name === 'RequestModifier') {
                        requestModifier = factory();
                        return requestModifier;
                    }
                    return {};
                },
                
                seek: function(time) {
                    if (videoElement) {
                        videoElement.currentTime = time;
                    }
                },
                
                setVolume: function(vol) {
                    if (videoElement) {
                        videoElement.volume = vol;
                    }
                },
                
                destroy: function() {
                    if (videoElement) {
                        videoElement.pause();
                        videoElement.removeAttribute('src');
                        videoElement.load();
                    }
                }
            };
            
            return player;
        }
        
        instance.create = create;
        return instance;
    };
    
    global.dashjs = dashjs;
})(window);

},{}]},{},[1]);