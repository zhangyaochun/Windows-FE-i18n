'use strict';

var fs = require('fs');
var util = require('util');

module.exports = function (grunt) {
    // load all grunt tasks
    require('matchdep').filterDev('grunt-*').forEach(grunt.loadNpmTasks);

    // configurable paths
    var pathConfig = {
        app : 'app',
        dist : 'dist',
        tmp : 'tmp'
    };

    grunt.initConfig({
        paths : pathConfig,
        copy : {
            tmp : {
                files : [{
                    expand : true,
                    dot : true,
                    cwd : '<%= paths.app %>',
                    dest : '<%= paths.tmp %>',
                    src : [
                        'images/**/*.{png,gif}',
                        'stylesheets/**/*.{sass,scss,png,ttf}'
                    ]
                }]
            },
            nls : {
                files : [{
                    expand : true,
                    dot : true,
                    cwd : '<%= paths.tmp %>',
                    dest : '<%= paths.dist %>',
                    src : [
                        'i18n/**/*.js',
                    ]
                }]
            },
            dist : {
                files : [{
                    expand : true,
                    dot : true,
                    cwd : '<%= paths.tmp %>',
                    dest : '<%= paths.dist %>',
                    src : [
                        'i18n/**/stylesheets/{,*/}*.{css,ttf}'
                    ]
                }]
            }
        },
        compass : {
            options : {
                sassDir : '<%= paths.tmp %>/stylesheets/compass/sass',
                cssDir : '<%= paths.tmp %>/stylesheets',
                imagesDir : '<%= paths.tmp %>/stylesheets/compass/images',
                generatedImagesDir : '<%= paths.tmp %>/images',
                relativeAssets : true
            },
            dist : {
                options : {
                    outputStyle : 'compressed'
                }
            }
        },
        imagemin : {
            dist : {
                files : [{
                    expand : true,
                    cwd : '<%= paths.tmp %>/images',
                    src : '**/*.{png,jpg,jpeg}',
                    dest : '<%= paths.dist %>/images'
                }]
            }
        }
    });

    var copyFolderRecursive = function(path, dist, isDelete) {
        isDelete = isDelete ? true : false;

        if (!fs.existsSync(path)) {
            return;
        }

        if (fs.statSync(path).isDirectory()) {
            fs.readdirSync(path).forEach(function (file) {
                var curPath = path + '/' +  file;
                var distPath = dist + '/' + file;
                if(fs.statSync(curPath).isDirectory()) {
                    copyFolderRecursive(curPath, distPath, isDelete);
                } else {
                    grunt.file.copy(curPath, distPath);
                    isDelete && fs.unlinkSync(curPath);
                }
            });
            isDelete && fs.rmdirSync(path);
        } else {
            grunt.file.copy(path, dist);
            isDelete && fs.unlinkSync(path);
        }
    };

    var moveImages = function(nls, base, src, dist) {

        if (!fs.existsSync(src)) {
            return;
        }

        if (fs.statSync(src).isDirectory()) {
            fs.readdirSync(src).forEach(function (file) {

                if (nls == base) {

                    var curPath = src + '/' +  file;
                    var distPath = dist + '/' + file;
                    if(fs.statSync(curPath).isDirectory()) {
                        moveImages(nls, base, curPath, distPath);
                    } else {
                        grunt.file.copy(curPath, distPath);
                        fs.unlinkSync(curPath);
                    }

                } else {

                    if (file.indexOf(nls) > -1) {
                        var curPath = src + '/' +  file;
                        var distPath = dist + '/' + file;
                        grunt.file.copy(curPath, distPath);
                        fs.unlinkSync(curPath);
                    }

                }
            });

            grunt.file.delete(src);
        } else {
            grunt.file.copy(src, dist);
            fs.unlinkSync(src);
        }

    };


    var deleteFolderRecursive = function(path) {
        if (fs.existsSync(path)) {
            fs.readdirSync(path).forEach(function(file,index){
                var curPath = path + "/" + file;
                if(fs.statSync(curPath).isDirectory()) {
                    deleteFolderRecursive(curPath);
                } else {
                    fs.unlinkSync(curPath);
                }
            });
            fs.rmdirSync(path);
        }
    };

    var removeItem = function(source, item){
        var len = source.length;

        while(len --) {
            if (len in source && source[len] === item) {
                source.splice(len, 1);
            }
        }

        return source;
    };

    grunt.registerTask('processI18n', function (nls) {

        deleteFolderRecursive(pathConfig.dist + '/i18n/' + nls);

        var i18nPath = pathConfig.tmp + '/i18n';
        fs.mkdirSync(i18nPath);

        var i18nNlsPath = i18nPath + '/' + nls;
        fs.mkdirSync(i18nNlsPath);

        i18nNlsPath += '/nls';
        fs.mkdirSync(i18nNlsPath);
        fs.mkdirSync(i18nNlsPath + '/' + nls);

        var content;
        fs.readdirSync(pathConfig.app + '/nls/' + nls).forEach(function (file) {
            if (file.substr(0, 1) === '.') {
                return;
            } else {
                var nlsJson = grunt.file.read(pathConfig.app + '/nls/' + nls + '/' + file);
                var nlsContent = 'define({"'+ nls  +'" : ' + nlsJson + '});';
                var fileName = file.replace('json', 'js');
                grunt.file.write(i18nNlsPath + '/' + fileName, nlsContent);
            }
        });

        var fd;
        if (nls !== 'zh-cn') {
            var mainScss = pathConfig.tmp + '/stylesheets/compass/sass/main.scss';
            fd = fs.openSync(mainScss, 'a');

            fs.writeSync(fd, '@import "_locale-' + nls + '.scss"');
            fs.closeSync(fd);
        }
    });

    grunt.registerTask('copyCss', function (nls) {

        var stylePath = pathConfig.tmp + '/i18n/' + nls + '/stylesheets';
        fs.mkdirSync(stylePath);
        fs.readdirSync(pathConfig.tmp + '/stylesheets/').forEach(function (file){
            if (file.substr(0, 1) === '.' || file === 'compass') {
                return;
            } else {
                copyFolderRecursive(pathConfig.tmp + '/stylesheets/' + file, stylePath + '/' + file);
            }
        });
    });

    grunt.registerTask('createScssConfig', function (project) {

        var filePath = pathConfig.tmp + '/stylesheets/compass/sass/_projectflag.scss';
        var content = '';
        switch (project) {
        case 'WDJ':
            content = '$PROJECT_FLAG : PROJECT_WD';
            break;
        case 'SUNING':
            content = '$PROJECT_FLAG : PROJECT_SUNING';
            break;
        case 'TIANYIN':
            content = '$PROJECT_FLAG : PROJECT_TIANYIN';
            break;
        case 'LEYU':
            content = '$PROJECT_FLAG : PROJECT_LEYU';
            break;
        }

        grunt.file.write(filePath, content);
    });

    grunt.registerTask('mvImageMin', function (nls, base) {
        moveImages(nls, base, pathConfig.dist + '/images/', pathConfig.dist + '/i18n/' + nls + '/images/');
    });

    grunt.registerTask('clean', function (nls) {
        deleteFolderRecursive(pathConfig.tmp);
        deleteFolderRecursive(pathConfig.dist + '/images/');
        deleteFolderRecursive(pathConfig.dist + '/i18n/' + nls);
    });

    grunt.registerTask('copyImage', function (nls) {
        copyFolderRecursive(pathConfig.tmp + '/images/', pathConfig.dist + '/images/');
    });

    grunt.registerTask('build', function (project, nls) {

        project = project ? project.toUpperCase() : 'WDJ';
        var nlss = nls ? nls.toLowerCase().split(',') : ['zh-cn'];

        var base = 'en-us';

        //check base for i18n
        if (arguments.length === 3 && typeof arguments[2] === 'string') {
            base = arguments[2];
            //del first
            if (nls.indexOf(arguments[2]) > -1) { 
                nlss = removeItem(nlss, base);
            }
            
            nlss.push(arguments[2]);
        } else if (arguments.length === 2 && nlss.length === 1) {
            //single build
            base = nls;
        }



        console.log('project : ', project);
        console.log('nls : ', nls);
        console.log(nlss);

        nlss.forEach(function (nls) {
            var taskList = [
                'clean:' + nls,
                'copy:tmp',
                'processI18n:' + nls,
                'createScssConfig:' + project,
                'compass:dist',
                'copyCss:' + nls,
                'copy:nls',
                'copyImage:' + nls,
                'imagemin',
                'copy:dist',
                'mvImageMin:' + nls + ':' + base
            ];

            grunt.task.run(taskList);
        });
    });

    grunt.registerTask('test:travis', ['build']);
};
