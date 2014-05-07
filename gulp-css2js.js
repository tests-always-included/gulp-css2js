/**
 * Embed CSS into JavaScript
 *
 * This will take your CSS and convert it into JavaScript.  When executed,
 * the resulting code will generate a <script> element and put the CSS text
 * into it.  Instead of having an external file for your necessary styles,
 * they are embedded into your library.
 *
 * As an exercise and possibly as an example for other Gulp developers,
 * this plugin supports both buffers and streams.
 */

(function () {
    'use strict';

    var gulpUtil, prefixBuffer, suffixBuffer, through2;

    /**
     * @typedef {Object} gulpCss2js~options
     * @property {string} remainder Leftover newlines from last write
     * @property {boolean} [splitOnNewline=true]
     * @property {boolean} [trimSpacesBeforeNewline=true]
     * @property {boolean} [trimTrailingNewline=false]
     */

    /**
     * Escapes content to be used in the middle of a JavaScript string.
     * This string will be surrounded by double quotes elsewhere, but this
     * is important because we need to escape double quotes in the buffers.
     *
     * @param {Buffer} bufferIn
     * @param {gulpCss2js~options} options
     * @param {boolean} trimTrailingNewlineDefault
     * @return {Buffer}
     */
    function escapeBuffer(bufferIn, encoding, options) {
        var newlines, str;

        try {
            str = bufferIn.toString(encoding);
        } catch (e) {
            str = bufferIn.toString();
            encoding = 'utf8';
        }

        /* If there was a chunk left over from a previous write, add it back.
         * This portion of code should only get executed when:
         *     a stream is being processed
         *     a chunk ends in a newline
         *     another chunk comes after it
         */
        if (options.remainder) {
            str = options.remainder + str;
            options.remainder = '';
        }

        // Escape backslashes and double quotes
        str = str.replace(/\\/g, '\\\\');
        str = str.replace(/"/g, '\\"');

        // Newline conversion
        str = str.replace(/(\r?\n|\r)/g, '\n');

        // Remove spaces before newlines
        if (options.trimSpacesBeforeNewline) {
            str = str.replace(/[\t ]*\n/g, '\n');
        }

        // Trim the last newline or convert it so it is preserved properly
        if (options.trimTrailingNewline) {
            newlines = str.match(/\n*$/);

            if (newlines && newlines[0]) {
                options.remainder = newlines[0];
                str = str.replace(/\n*$/, '');
            }
        } else {
            /* Prevent the last line from looking like this when encoded:
             *    ".css { display: block }\n" +
             *    ""
             */
            str = str.replace(/\n$/, '\\n');
        }

        // Break on newlines
        if (options.splitOnNewline) {
            str = str.replace(/\n/g, '\\n" +\n"');
        } else {
            str = str.replace(/\n/g, '\\n');
        }

        return new Buffer(str, encoding);
    }

    /**
     * Uses Through2 to create a stream translation that converts CSS
     * into JavaScript.
     *
     * @param {gulpCss2js~options} options
     * @return {Stream}
     */
    function convertStream(options) {
        var outStream;

        outStream = through2(function (chunk, encoding, callback) {
            this.push(escapeBuffer(chunk, encoding, options));
            callback();
        }, function (callback) {
            this.push(suffixBuffer);
            callback();
        });
        outStream.push(prefixBuffer);

        return outStream;
    }

    gulpUtil = require('gulp-util');
    through2 = require('through2');
    prefixBuffer = new Buffer('(function (doc, cssText) {\n' +
        '    var styleEl = doc.createElement("style");\n' +
        '    doc.getElementsByTagName("head")[0].appendChild(styleEl);\n' +
        '    if (styleEl.styleSheet) {\n' +
        '        if (!styleEl.styleSheet.disabled) {\n' +
        '            styleEl.styleSheet.cssText = cssText;\n' +
        '        }\n' +
        '    } else {\n' +
        '        try {\n' +
        '            styleEl.innerHTML = cssText;\n' +
        '        } catch (ignore) {\n' +
        '            styleEl.innerText = cssText;\n' +
        '        }\n' +
        '    }\n' +
        '}(document, "', 'utf8');
    suffixBuffer = new Buffer('"));\n', 'utf8');

    module.exports = function (options) {
        /**
         * Default a parameter
         *
         * @param {string} key
         * @param {*} fallbackValue Value to use if current is undefined
         * @return {*}
         */
        function fallback(key, fallbackValue) {
            if (options[key] === undefined) {
                options[key] = fallbackValue;
            }
        }


        options = options || {};
        options.remainder = '';
        fallback('splitOnNewline', true);
        fallback('trimSpacesBeforeNewline', true);
        fallback('trimTrailingNewline', true);

        return through2.obj(function (file, encoding, callback) {
            if (file.isBuffer()) {
                file.contents = Buffer.concat([
                    prefixBuffer,
                    escapeBuffer(file.contents, encoding, options),
                    suffixBuffer
                ]);
                file.path = gulpUtil.replaceExtension(file.path, ".js");
            } else if (file.isStream()) {
                file.contents = file.contents.pipe(convertStream(options));
                file.path = gulpUtil.replaceExtension(file.path, ".js");
            } else if (!file.isNull()) {
                // Not sure what this could be, but future-proofing the code.
                this.emit('error', new gulpUtil.PluginError('gulp-css2js', 'Unhandled file source type.'));
                return callback();
            }

            this.push(file);
            return callback();
        });
    };

    // Export these too for easier testing
    module.exports.prefixBuffer = prefixBuffer;
    module.exports.suffixBuffer = suffixBuffer;
}());
