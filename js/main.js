/* ===================================================================
   StableScheduler.com — Landing Page JavaScript
   Handles hamburger nav only. Auth handled by auth.js.
   =================================================================== */

(function () {
    'use strict';

    function initNav() {
        var hamburger = document.getElementById('hamburger');
        var navLinks = document.getElementById('navLinks');

        if (hamburger) {
            hamburger.addEventListener('click', function () {
                navLinks.classList.toggle('open');
            });
        }

        if (navLinks) {
            navLinks.querySelectorAll('a').forEach(function (a) {
                a.addEventListener('click', function () {
                    navLinks.classList.remove('open');
                });
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initNav);
    } else {
        initNav();
    }

})();
