const test = () => {
    const cmd = "/data/workspace/ffmpeg_compare   -i  /data/workspace/frame_align/cut_5min_sei_added.flv  -i /data/workspace/frame_align/4000_out.flv -hide_banner -max_muxing_queue_size 1024 -an -lavfi '[0:v]scale=1920:1080:flags=lanczos[ref];[1:v]scale=1920:1080:flags=lanczos[distorted];[ref][distorted]frame_align[ref_frame_align_out][distorted_frame_align_out];[ref_frame_align_out]split=2[ref_psnr_in][ref_ssim_in];[distorted_frame_align_out]split=2[distorted_psnr_in][distorted_ssim_in];[ref_psnr_in][distorted_psnr_in]psnr=frame_sync_type=nframes:stats_file=/data/workspace/result_psnr.txt;[ref_ssim_in][distorted_ssim_in]ssim=frame_sync_type=nframes:stats_file=/data/workspace/vmaf_vxcode_id_0_ssim.txt' -f null -"

    const regex = new RegExp(`(?=-)`)
    const paramsLevel1 = cmd.split(regex)
    // console.log(paramsLevel1)

    paramsLevel1.forEach(paramLevel1 => {
        const paramArr = paramLevel1.split(" ")
        const paramName = paramArr[0]
        if ('-lavfi' == paramName || '-filter_complex' == paramName) {
            console.log(paramArr[1])
            // const paramsLevel2 = paramArr[1].split(";")

            const regex2 = new RegExp(`(?<=;)`)
            const paramsLevel2 = paramArr[1].split(regex2)
            console.log(paramsLevel2)
        }
    })
}

test()
