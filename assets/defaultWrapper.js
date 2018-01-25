/**
 * This code is used for the default prefix and suffix.
 * It is minified with uglify-js during the build step.
 * It is split into prefix and suffix by the $$$ bit.
 * It should stay written in ES5.
 */
(function (doc, cssText) {
    var styleEl = doc.createElement("style");
    doc.getElementsByTagName("head")[0].appendChild(styleEl);
    if (styleEl.styleSheet) {
        if (!styleEl.styleSheet.disabled) {
            styleEl.styleSheet.cssText = cssText;
        }
    } else {
        try {
            styleEl.innerHTML = cssText;
        } catch (ignore) {
            styleEl.innerText = cssText;
        }
    }
}(document, "$$$"));
