const haveCodecParams = str => {
    return str.search(/-[a-zA-Z0-9]+-params/i) >= 0
}

const filterStringParser = (str) => {
    const regex = new RegExp(`(?:;)`)
    return str.trim().split(regex).map(x => x.trim()).filter(x => '' !== x)
}

/**
 * TODO: 去重
 * */
const filterPadsParser = (str) => {
    const regex = new RegExp(`(?<=\\[)(.+?)(?=\\])`, 'g')
    const result = str.match(regex)
    return result instanceof Array ? result.map(x => x.trim()).filter(x => '' !== x) : []
}

const filterPadsInParser = (str) => {
    const filterPadsInStringParser = (str) => {
        const regex = new RegExp(`^(\\[\\S*?(?:\\]))+`, 'g')
        const result = str.match(regex)
        return result instanceof Array ? result.map(x => x.trim()).filter(x => '' !== x) : []
    }

    const padsInStrings = filterPadsInStringParser(str)
    const padsInString = padsInStrings.length > 0 ? padsInStrings[0] : ''

    return filterPadsParser(padsInString)
}

const filterPadsOutParser = (str) => {
    const filterPadsOutStringParser = (str) => {
        const regex = new RegExp(`(?<=[^\\]])((\\[\\w*(?:\\]))+$)`, 'g')
        const result = str.match(regex)
        return result instanceof Array ? result.map(x => x.trim()).filter(x => '' !== x) : []
    }

    const padsOutStrings = filterPadsOutStringParser(str)
    const padsOutString = padsOutStrings.length > 0 ? padsOutStrings[0] : ''

    return filterPadsParser(padsOutString)
}

const filterOptParser = (str) => {
    const regex = new RegExp(`(?:\\[)[^\\[\\]]*(?:\\])`)
    return str.trim().split(regex).map(x => x.trim()).filter(x => '' !== x)
}

const codecParamsParser = (str) => {
    const regex = new RegExp(`(-[a-zA-Z0-9]+-params[ ]+[^ ]+)`)
    return str.trim().split(regex).map(x => x.trim()).filter(x => '' !== x)
}

const quoteParamsParser = (str) => {
    const regex = new RegExp(`(-[a-zA-Z0-9_-]+[ ]+(?:"(?:[^"]+)"|\'(?:[^\']+)\'))`)
    return str.trim().split(regex).map(x => x.trim()).filter(x => '' !== x)
}

const ffmpegSimgleParamParser = (str) => {
    const regex = new RegExp(`(-[a-zA-Z0-9_-]+[ ]+)`)
    const regexQuote = new RegExp(`(((?<=\\')(.*)(?=\\'))|((?<=\\")(.*)(?=\\")))`, 'g')
    result = str.trim().split(regex).map(x => x.trim()).filter(x => '' !== x)

    if (result.length >= 2) {
        if (result[1].search(regexQuote) > 0) result[1] = result[1].match(regexQuote)[0]
    }
    return result
}


/** 
 * Interface FilterStruct {
 *     in: Array<string>;
 *     opt: string;
 *     out: Array<string>;
 * }
 * 
 * Interface FilterStruct: Array<FilterStruct>
 */
const filterComplexParser = (str) => {
    const result = []
    const filters = filterStringParser(ffmpegSimgleParamParser(str)[1])

    filters.forEach(filter => {
        const filterStruct = {
            in: filterPadsInParser(filter),
            opt: filterOptParser(filter),
            out: filterPadsOutParser(filter)
        }

        result.push(filterStruct)
    })

    return result
}

const filterComplexRelation = (filterStructs) => {
    const padsFromMap = new Map()
    const padsToMap = new Map()

    for (let i = 0; i < filterStructs.length; i++) {
        const filterStruct = filterStructs[i]
        const inPads = filterStruct['in']
        const outPads = filterStruct['out']

        for (let j = 0; j < inPads.length; j++) {
            const inPad = inPads[j]
            padsToMap.set(inPad, [i, j])  // [filterIndex, inPadIndex]
        }

        for (let j = 0; j < outPads.length; j++) {
            const outPad = outPads[j]
            padsFromMap.set(outPad, [i, j])  // [filterIndex, inPadIndex]
        }
    }

    return {
        "fromMap": padsFromMap,
        "toMap": padsToMap
    }
}

const filterComplexGraph = (filters, filtersRelation) => {
    for (let i = 0; i < filters.length; i++) {
        const sourceFilter = filters[i]
        const opt = sourceFilter['opt']
        for (let j = 0; j < sourceFilter['out'].length; j++) {
            const outPad = sourceFilter['out'][j]
            const targetPos = filtersRelation['toMap'].get(outPad) // [filterIndex, inPadIndex]
            const targetFilter = filters[targetPos[0]]
            console.log(`${opt[0]}[${outPad}] -> [${targetFilter['in'][targetPos[1]]}]${targetFilter['opt'][0]}`)
        }
    }
}

const filterComplexGraphNode = (filters) => {
    const result = []

    for (let i = 0; i < filters.length; i++) {
        result.push({
            "id": `${i}:${filters[i]['opt']}`,
            "label": `${filters[i]['opt']}`,
            "shape": "rect"
        })
    }
    return result
}

const filterComplexGraphLink = (filters, filtersRelation) => {
    const result= []

    for (let i = 0; i < filters.length; i++) {
        const sourceFilter = filters[i]
        const opt = sourceFilter['opt']
        for (let j = 0; j < sourceFilter['out'].length; j++) {
            const outPad = sourceFilter['out'][j]
            const targetPos = filtersRelation['toMap'].get(outPad) // [filterIndex, inPadIndex]
            const targetFilter = filters[targetPos[0]]
            result.push({
                "source": `${i}:${sourceFilter['opt']}`,
                "target": `${targetPos[0]}:${targetFilter['opt'][0]}`,
                "label": outPad
            })
        }
    }

    return result
}

const ffmpegParamsParser = (str, separator = '-', position = -1) => {
    const result = []
    const regex = position < 0 ? new RegExp(`(?<=${separator})`) : new RegExp(`(?=[ ]${separator})`)
    const params = str.trim().split(regex).map(x => x.trim()).filter(x => '' !== x)

    params.forEach(param => {
        const paramArr = ffmpegSimgleParamParser(param)

        if ('-lavfi' == paramArr[0] || '-filter_complex' == paramArr[0]) {
            result.push({
                name: paramArr[0],
                value: ffmpegParamsParser(paramArr[paramArr.length - 1], ';', -1)
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
    const codectedParams = codecParamsParser(cmd)

    codectedParams.forEach(param => {
        if (haveCodecParams(param)) {
            const paramArr = ffmpegSimgleParamParser(param)
            result.push({
                name: paramArr[0],
                value: ffmpegParamsParser(paramArr[paramArr.length - 1], ':', -1)
            })
        } else {
            const quotedParams = quoteParamsParser(param)
            quotedParams.forEach(quotedParam => {
                const t = ffmpegParamsParser(quotedParam, '-', 1)
                result = [...result, ...t]
            })
            
        }
    })
    return dump(result)
}

const test = () => {
    const cmd = "/data/workspace/ffmpeg_compare   -i  /data/workspace/frame_align/cut_5min_sei_added.flv  -i /data/workspace/frame_align/4000_out.flv -hide_banner -max_muxing_queue_size 1024 -an -lavfi '[0:v]scale=1920:1080:flags=lanczos[ref];[1:v]scale=1920:1080:flags=lanczos[distorted];[ref][distorted]frame_align[ref_frame_align_out][distorted_frame_align_out];[ref_frame_align_out]split=2[ref_psnr_in][ref_ssim_in];[distorted_frame_align_out]split=2[distorted_psnr_in][distorted_ssim_in];[ref_psnr_in][distorted_psnr_in]psnr=frame_sync_type=nframes:stats_file=/data/workspace/result_psnr.txt;[ref_ssim_in][distorted_ssim_in]ssim=frame_sync_type=nframes:stats_file=/data/workspace/vmaf_vxcode_id_0_ssim.txt' -x264-params threads=1:br=1000:maxrate=1000:minrate=1000:bufsize=1000 -f null -"
    
    console.log(format(cmd))
}

test()
