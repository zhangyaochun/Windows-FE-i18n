#!/usr/bin/env sh

if [ $# -eq 0 ]
then
PROJECT='WDJ';
nls='zh-cn';
else
if [$# -eq 1]
then
PROJECT=$1;
nls='zh-cn';
else
PROJECT=$1;
nls=$2;
fi
fi


grunt clean:$nls
grunt copy:tmp
grunt processI18n:$nls
grunt createScssConfig:$PROJECT
grunt compass:dist
grunt copyCss:$nls
grunt copyImage:$nls
grunt copy:nls
grunt imagemin
grunt copy:dist
grunt mvImageMin:$nls
