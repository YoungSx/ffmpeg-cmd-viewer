# FFmpeg CMD Viewer
鉴于 FFmpeg 命令经常又臭又长，导致阅读十分困难。所以本项目用来格式化 FFmpeg 命令，以更清晰地阅读命令中的参数。

[Demo](http://shangxin.me/ffmpeg-cmd-viewer/)

# TODO
## Feature
* ~~filter complex graph 绘制输入音视频流~~
* ~~filter complex graph 绘制输出~~
* filter complex graph 标明 pads 输入输出顺序

## Bug
* 无法清除上一次绘制
* formatted string 输出丢失
* ~~filter complex 两个节点间无法同时存在两条边~~
* 替换转义符
* 负数被误解析成命令
