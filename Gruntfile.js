'use strict';

var fs = require('fs');
var rimraf = require('rimraf');

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

    var mvSelfImages = function(nls, src, dist) {

        if (!fs.existsSync(src)) {
            return;
        }

        if (fs.statSync(src).isDirectory()) {
            fs.readdirSync(src).forEach(function (file) {

                //just copy nls 
                if (file.indexOf(nls) > -1) {
                    
                    /* 
                     * @ fix link images/zh-cn
                     * @TODO now we just support like images/zh-cn/a.gif images/zh-cn/b.gif
                     * instead of images/zh-cn/module/a.gif or images/zh-cn/module/submodule/a.gif
                     */
                    if (fs.statSync(src + file).isDirectory()) {

                        fs.readdirSync(src + file).forEach(function (subfile) {
                            var curPath = src + file + '/' + subfile;
                            var distPath = dist + '/' + subfile;

                            grunt.file.copy(curPath, distPath);
                        });


                    } else {

                        //fix link zh-cn-s3fcacda7f4.png from stylesheets/compass/images/zh-cn
                        var curPath = src  +  file;
                        var distPath = dist + file;
                        grunt.file.copy(curPath, distPath);

                    }

                }

            });

        }

    };


    var copyNoI18nFolder = function(path, dist) {

        if (!fs.existsSync(path)) {
            return;
        }

        //get nlss use grunt._lang;
        var nlsArr = grunt._lang || ['zh-cn','en-us','th-th'];

        if (fs.statSync(path).isDirectory()) {

            fs.readdirSync(path).forEach(function (file) {
                var curPath = path + '/' +  file;
                var distPath = dist + '/' + file;

                //rm all nls array file from filename
                nlsArr.forEach(function(nls){
                    console.log('nls: ' + nls);
                    console.log(curPath.indexOf(nls));
                    if (curPath.indexOf(nls) > -1) {
                        rimraf.sync(curPath);
                    }
                });

            });

        }

        //then copy
        copyFolderRecursive(path, dist, true);

    };


    grunt.registerTask('processI18n', function (nls) {

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
        }

        grunt.file.write(filePath, content);
    });

    grunt.registerTask('mvImageMin', function (nls, base) {
        mvSelfImages(nls, pathConfig.dist + '/images/', pathConfig.dist + '/i18n/' + nls + '/images/');
    });

    grunt.registerTask('clean', function (nls) {
        rimraf.sync(pathConfig.tmp);
        rimraf.sync(pathConfig.dist + '/images/');
        rimraf.sync(pathConfig.dist + '/i18n/' + nls);
    });

    grunt.registerTask('copyImage', function (nls) {
        copyFolderRecursive(pathConfig.tmp + '/images/', pathConfig.dist + '/images/');
    });


    grunt.registerTask('copyCommonImages', function () {
        //delet
        rimraf.sync(pathConfig.dist + '/i18n/images');

        copyNoI18nFolder(pathConfig.dist + '/images', pathConfig.dist + '/i18n/images');

    });

    grunt.registerTask('replaceCommon', function (nls) {
        var cssPath = pathConfig.dist + '/i18n/' + nls + '/stylesheets';

        if (!fs.existsSync(cssPath)) {
            grunt.fail.warn('Task replaceCommon:' + bls + 'faild for cannot find css path: ' + cssPath);
            return;
        }

        if (fs.statSync(cssPath).isDirectory()) {
            fs.readdirSync(cssPath).forEach(function(file){
                if (grunt.util._.endsWith(file, '.css')) {
                    //now for two kinds for sprit path, we choose to replace common
                    var output = grunt.file.read(cssPath + '/' + file).replace('../images/common','../../images/common');
                    grunt.file.write(cssPath + '/' + file,output);
                }
            });
        }
    });

    grunt.registerTask('build', function (project, nls) {

        project = project ? project.toUpperCase() : 'WDJ';
        var nlss = nls ? nls.toLowerCase().split(',') : ['zh-cn'];


        console.log('project : ', project);
        console.log('nls : ', nls);
        console.log(nlss);

        //set nlss in grunt
        grunt._lang = nlss;

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
                'replaceCommon:' + nls,
                'mvImageMin:' + nls
            ];

            grunt.task.run(taskList);
        });

        //last copy common images
        grunt.task.run('copyCommonImages');

    });

    grunt.registerTask('test:travis', ['build']);
};
