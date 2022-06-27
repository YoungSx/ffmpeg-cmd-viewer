const parser = (str, separator = '-', position = -1) => {
    const result = []
    const regex = position < 0 ? new RegExp(`(?<=${separator})`) : new RegExp(`(?=[ ]${separator})`)
    const params = str.trim().split(regex)

    params.forEach(param => {
        const paramArr = param.trim().split(" ")

        if ('-lavfi' == paramArr[0] || '-filter_complex' == paramArr[0]) {
            result.push({
                name: paramArr[0],
                value: parser(paramArr[paramArr.length - 1], ';', -1)
            })
        } else {
            result.push({
                name: paramArr[0],
                value: paramArr.length > 1 ? paramArr[paramArr.length - 1] : ''
            })
        }
    })
    return result
}

const dump = (params, deep = -1) => {
    const indentUnit = '    '
    let indent = ''
    let result = ''
    for (let i = 0; i < deep; i++) indent += indentUnit
    if (params instanceof Array) {
        for (let i = 0; i < params.length; i++) {
            result += dump(params[i], deep + 1)
        }
    } else if (params instanceof Object) {
        if ('string' == typeof params['value']) result += `${indent}${params['name']} ${dump(params['value'], deep + 1)}\n`
        else result += `${indent}${params['name']}\n${dump(params['value'], deep + 1)}`
    } else result = `${params}`
    return result
}

const format = cmd => {
    let result = []
    const regex = new RegExp(`(-[a-zA-Z0-9]+-params[ ]+[^ ]+)`)
    const params = cmd.trim().split(regex)

    params.forEach(param => {
        if (haveCodecParams(param)) {
            const paramArr = param.trim().split(" ")
            result.push({
                name: paramArr[0],
                value: parser(paramArr[paramArr.length - 1], ':', -1)
            })
        } else {
            const t = parser(param, '-', 1)
            result = [...result, ...t]
        }
    })
    return dump(result)
}

const haveCodecParams = str => {
    return str.search(/-[a-zA-Z0-9]+-params/i) >= 0
}

const test = () => {
    const cmd = "/data/workspace/ffmpeg_compare   -i  /data/workspace/frame_align/cut_5min_sei_added.flv  -i /data/workspace/frame_align/4000_out.flv -hide_banner -max_muxing_queue_size 1024 -an -lavfi '[0:v]scale=1920:1080:flags=lanczos[ref];[1:v]scale=1920:1080:flags=lanczos[distorted];[ref][distorted]frame_align[ref_frame_align_out][distorted_frame_align_out];[ref_frame_align_out]split=2[ref_psnr_in][ref_ssim_in];[distorted_frame_align_out]split=2[distorted_psnr_in][distorted_ssim_in];[ref_psnr_in][distorted_psnr_in]psnr=frame_sync_type=nframes:stats_file=/data/workspace/result_psnr.txt;[ref_ssim_in][distorted_ssim_in]ssim=frame_sync_type=nframes:stats_file=/data/workspace/vmaf_vxcode_id_0_ssim.txt' -x264-params threads=1:br=1000:maxrate=1000:minrate=1000:bufsize=1000 -f null -"
    
    console.log(format(cmd))
}

test()
