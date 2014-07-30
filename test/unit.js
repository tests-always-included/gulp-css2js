/**
 * Gulp plugins really aught to have tests.  Here's some great tests for
 * gulp-css2js.
 */
/*global afterEach, beforeEach, describe, it*/

'use strict';

var Assert, css2js, gulpUtil, stream;

Assert = require('assert');
css2js = require('../');
gulpUtil = require('gulp-util');
stream = require('stream');

function runThroughStream(expected, srcFile, options, done) {
    var stream;

    stream = css2js(options);
    stream.on("data", function (newFile) {
        var buffer;

        Assert.equal(newFile.path, expected.path);
        Assert.equal(newFile.cwd, expected.cwd);
        Assert.equal(newFile.base, expected.base);

        if (newFile.isStream()) {
            // Convert a stream into a buffer and test when it's done
            buffer = '';
            newFile.contents.on('data', function (chunk, encoding) {
                buffer += chunk.toString(encoding);
            });
            newFile.contents.on('end', function () {
                Assert.equal(buffer, expected.contents.toString());
                done();
            });
        } else if (expected.contents === null) {
            Assert.equal(newFile.contents, expected.contents);
            done();
        } else {
            Assert.equal(newFile.contents.toString(), expected.contents.toString());
            done();
        }
    });
    stream.write(srcFile);
    stream.end();
}

function makeFile(contents, path) {
    if (typeof contents === 'string') {
        contents = new Buffer(contents, 'utf8');
    }

    return new gulpUtil.File({
        path: path || "test/styles/testing.css",
        cwd: "test/",
        base: "test",
        contents: contents
    });
}

function makeEncodedFile(contents) {
    contents = css2js.prefixBuffer.toString() + contents + css2js.suffixBuffer.toString();

    return makeFile(contents, "test/styles/testing.js");
}

describe('gulp-css2js', function () {
    it('exported a function', function () {
        Assert.equal('function', typeof css2js);
    });

    describe('null files', function () {
        it('passes them through', function (done) {
            runThroughStream(makeFile(null), makeFile(null), {}, done);
        });
    });
    describe('buffered files', function () {
        it('embeds CSS', function (done) {
            runThroughStream(makeEncodedFile('.d-b { display: block }'), makeFile('.d-b { display: block }'), {}, done);
        });
    });
    describe('streamed files', function () {
        var sourceFile, streamChunks;

        beforeEach(function () {
            streamChunks = [];
            sourceFile = makeFile('');
            sourceFile.contents = new stream.Readable();
            sourceFile.contents._read = function () {
                if (streamChunks.length) {
                    this.push(new Buffer(streamChunks.shift(), 'utf8'), 'utf8');
                } else {
                    this.push(null);
                }
            };
        });
        it('embeds CSS', function (done) {
            streamChunks.push('.d-b {');
            streamChunks.push(' display: blo');
            streamChunks.push('ck }');
            runThroughStream(makeEncodedFile('.d-b { display: block }'), sourceFile, {}, done);
        });
        it('compensates for newlines at the end of chunks', function (done) {
            streamChunks.push("line1 {}\n");
            streamChunks.push("line2 {}\n");
            runThroughStream(makeEncodedFile('line1 {}\\n" +\n"line2 {}'), sourceFile, {
                trimTrailingNewline: true
            }, done);
        });
    });
    describe('options', function () {
        describe('splitOnNewline', function () {
            var disabledOutput, enabledOutput, input;

            beforeEach(function () {
                input = "body { margin: 0 }\nh1 { padding-top: 10px }\n";
                disabledOutput = 'body { margin: 0 }\\nh1 { padding-top: 10px }\\n';
                enabledOutput = 'body { margin: 0 }\\n" +\n"h1 { padding-top: 10px }\\n';
            });
            it('defaults to true', function (done) {
                runThroughStream(makeEncodedFile(enabledOutput), makeFile(input), {
                    trimTrailingNewline: false
                }, done);
            });
            it('does not break lines if disabled', function (done) {
                runThroughStream(makeEncodedFile(disabledOutput), makeFile(input), {
                    splitOnNewline: false,
                    trimTrailingNewline: false
                }, done);
            });
            it('breaks on newlines but avoids empty string concatenation at the end when enabled', function (done) {
                runThroughStream(makeEncodedFile(enabledOutput), makeFile(input), {
                    splitOnNewline: true,
                    trimTrailingNewline: false
                }, done);
            });
        });
        describe('trimSpacesBeforeNewline', function () {
            var disabledOutput, enabledOutput, input;

            beforeEach(function () {
                input = "a, \t \ndiv { display: block }    \n";
                disabledOutput = 'a, \t \\ndiv { display: block }    ';
                enabledOutput = 'a,\\ndiv { display: block }';
            });
            it('defaults to true', function (done) {
                runThroughStream(makeEncodedFile(enabledOutput), makeFile(input), {
                    splitOnNewline: false
                }, done);
            });
            it('does not trim spaces if disabled', function (done) {
                runThroughStream(makeEncodedFile(disabledOutput), makeFile(input), {
                    splitOnNewline: false,
                    trimSpacesBeforeNewline: false
                }, done);
            });
            it('trims spaces when enabled', function (done) {
                runThroughStream(makeEncodedFile(enabledOutput), makeFile(input), {
                    splitOnNewline: false,
                    trimSpacesBeforeNewline: true
                }, done);
            });
        });
        describe('trimTrailingNewline', function () {
            var disabledOutput, enabledOutput, input;

            beforeEach(function () {
                input = "div { display: block }\n";
                disabledOutput = 'div { display: block }\\n';
                enabledOutput = 'div { display: block }';
            });
            it('defaults to true', function (done) {
                runThroughStream(makeEncodedFile(enabledOutput), makeFile(input), {}, done);
            });
            it('does not trim newline if disabled', function (done) {
                runThroughStream(makeEncodedFile(disabledOutput), makeFile(input), {
                    trimTrailingNewline: false
                }, done);
            });
            it('trims newline when enabled', function (done) {
                runThroughStream(makeEncodedFile(enabledOutput), makeFile(input), {
                    trimTrailingNewline: true
                }, done);
            });
        });
        describe('prefix and suffix', function () {
            var input, output, prefix, suffix;

            input = 'div { display: block }';
            output = 'var a = "div { display: block }";';
            prefix = 'var a = "';
            suffix = '";';

            it('is true', function (done) {
                runThroughStream(makeFile(output, 'test/styles/testing.js'), makeFile(input), {
                    prefix: prefix,
                    suffix: suffix
                }, done);
            });
        });
    });
    describe('escaping', function () {
        it('escapes as necessary', function (done) {
            var escaped, unescaped;

            unescaped = '';
            escaped = '';

            // Double quotes - yes
            unescaped += '"';
            escaped += '\\"';

            // Single quotes - no
            unescaped += "'";
            escaped += "'";

            // Newlines are converted - Unix, DOS, old Mac
            unescaped += "\n \r\n \r";
            escaped += "\\n \\n \\n";

            // Tabs - no
            unescaped += "\t";
            escaped += "\t";

            runThroughStream(makeEncodedFile(escaped), makeFile(unescaped), {
                splitOnNewline: false,
                trimSpacesBeforeNewline: false,
                trimTrailingNewline: false
            }, done);
        });
    });
});
