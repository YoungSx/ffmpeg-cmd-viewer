class FFmpegCmdViewer {
    haveCodecParams (str) {
        return str.search(/-[a-zA-Z0-9]+-params/i) >= 0
    }

    isStreamSpecifier (str) {
        return str.search(/[0-9]:[vVasdt](:[0-9])?/i) >= 0
    }

    filterPadsParser (str) {
        const regex = new RegExp(`(?<=\\[)(.+?)(?=\\])`, 'g')
        const result = str.match(regex)
        return result instanceof Array ? result.map(x => x.trim()).filter(x => '' !== x) : []
    }

    filterPadsInParser (str) {
        const filterPadsInStringParser = (str) => {
            const regex = new RegExp(`^(\\[\\S*?(?:\\]))+`, 'g')
            const result = str.match(regex)
            return result instanceof Array ? result.map(x => x.trim()).filter(x => '' !== x) : []
        }

        const padsInStrings = filterPadsInStringParser(str)
        const padsInString = padsInStrings.length > 0 ? padsInStrings[0] : ''

        return this.filterPadsParser(padsInString)
    }

    filterPadsOutParser (str) {
        const filterPadsOutStringParser = (str) => {
            const regex = new RegExp(`(?<=[^\\]])((\\[\\w*(?:\\]))+$)`, 'g')
            const result = str.match(regex)
            return result instanceof Array ? result.map(x => x.trim()).filter(x => '' !== x) : []
        }

        const padsOutStrings = filterPadsOutStringParser(str)
        const padsOutString = padsOutStrings.length > 0 ? padsOutStrings[0] : ''

        return this.filterPadsParser(padsOutString)
    }

    filterOptParser (str) {
        const regex = new RegExp(`(?:\\[)[^\\[\\]]*(?:\\])`)
        return str.trim().split(regex).map(x => x.trim()).filter(x => '' !== x)
    }

    codecParamsParser (str) {
        const regex = new RegExp(`(-[a-zA-Z0-9]+-params[ ]+[^ ]+)`)
        return str.trim().split(regex).map(x => x.trim()).filter(x => '' !== x)
    }

    quoteParamsParser (str) {
        const regex = new RegExp(`(-[a-zA-Z0-9_-]+[ ]+(?:"(?:[^"]+)"|\'(?:[^\']+)\'))`)
        return str.trim().split(regex).map(x => x.trim()).filter(x => '' !== x)
    }

    ffmpegSingleParamParser (str) {
        const regex = new RegExp(`(-[a-zA-Z0-9_-]+[ ]+)`)
        const regexQuote = new RegExp(`(((?<=\\')(.*)(?=\\'))|((?<=\\")(.*)(?=\\")))`, 'g')
        const result = str.trim().split(regex).map(x => x.trim()).filter(x => '' !== x)

        if (result.length >= 2) {
            if (result[1].search(regexQuote) > 0) result[1] = result[1].match(regexQuote)[0]
        }
        return result
    }

    insertStartPlaceholder (filters) {
        let result = Object.assign([], filters)
        const startFakeFilter = {
            in: [],
            opt: ['start'],
            type: 'placeholder',
            out: []
        }
        result.forEach(filter => {
            const inPads = filter['in']
            inPads.forEach(pad => {
                if (this.isStreamSpecifier(pad)) startFakeFilter['out'].push(pad)
            })
        })
        if (startFakeFilter['out'].length > 0) result.unshift(startFakeFilter)

        return result
    }

    insertEndPlaceholder (filters) {
        let result = Object.assign([], filters)
        const filtersRelation = this.filterComplexRelation(filters)

        const endFakeFilter = {
            in: [],
            opt: ['end'],
            type: 'placeholder',
            out: []
        }
        for (let i = 0; i < filters.length; i++) {
            const sourceFilter = filters[i]
            for (let j = 0; j < sourceFilter['out'].length; j++) {
                const outPad = sourceFilter['out'][j]
                const targetPos = filtersRelation['toMap'].get(outPad) // [filterIndex, inPadIndex]
                // no out
                if (!targetPos) endFakeFilter['in'].push(outPad)
            }
        }
        if (endFakeFilter['in'].length > 0) result.push(endFakeFilter)

        return result
    }

    /** 
     * Interface FilterStruct {
     *     in: Array<string>;
     *     opt: string;
     *     type: string;
     *     out: Array<string>;
     * }
     * 
     * Interface FilterStruct: Array<FilterStruct>
     */
    filterComplexParser (filters) {
        const result = []

        filters.forEach(filter => {
            filter = filter['name']
            const filterStruct = {
                in: this.filterPadsInParser(filter),
                opt: this.filterOptParser(filter),
                type: 'opt',
                out: this.filterPadsOutParser(filter)
            }

            result.push(filterStruct)
        })

        return result
    }

    filterComplexRelation (filterStructs) {
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

    filterComplexGraphD3Data (list) {
        let filterDicts = []

        for (let i = 0; i < list.length; i++)
            if ('-lavfi' == list[i]['name'] || '-filter_complex' == list[i]['name']) {
                filterDicts = list[i]['value']
                break
            }

        let filters = this.filterComplexParser(filterDicts)
        filters = this.insertStartPlaceholder(filters)
        filters = this.insertEndPlaceholder(filters)
        const filtersRelation = this.filterComplexRelation(filters)

        return {
            "nodes": this.filterComplexGraphNode(filters),
            "edges": this.filterComplexGraphLink(filters, filtersRelation)
        }
    }

    filterComplexGraphNode (filters) {
        const result = []

        for (let i = 0; i < filters.length; i++) {
            result.push({
                "id": `${i}:${filters[i]['opt']}`,
                "label": `${filters[i]['opt']}`,
                "type": filters[i]['type'],
                "shape": "rect"
            })
        }
        return result
    }

    filterComplexGraphLink (filters, filtersRelation) {
        const result = []

        for (let i = 0; i < filters.length; i++) {
            const sourceFilter = filters[i]
            for (let j = 0; j < sourceFilter['out'].length; j++) {
                const outPad = sourceFilter['out'][j]
                const targetPos = filtersRelation['toMap'].get(outPad) // [filterIndex, inPadIndex]
                // no out
                if (!targetPos) continue
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

    ffmpegParamsParser (str, separator = '-', position = -1) {
        const result = []
        const regex = position < 0 ? new RegExp(`(?:${separator})`) : new RegExp(`(?=[ ]${separator})`)
        const params = str.trim().split(regex).map(x => x.trim()).filter(x => '' !== x)

        params.forEach(param => {
            const paramArr = this.ffmpegSingleParamParser(param)

            if ('-lavfi' == paramArr[0] || '-filter_complex' == paramArr[0]) {
                result.push({
                    name: paramArr[0],
                    value: this.ffmpegParamsParser(paramArr[paramArr.length - 1], ';', -1)
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

    dump (params, deep = -1) {
        const indentUnit = '    '
        let indent = ''
        let result = ''
        for (let i = 0; i < deep; i++) indent += indentUnit
        if (params instanceof Array) {
            for (let i = 0; i < params.length; i++) {
                result += this.dump(params[i], deep + 1)
            }
        } else if (params instanceof Object) {
            if ('string' == typeof params['value']) result += `${indent}${params['name']} ${this.dump(params['value'], deep + 1)}\n`
            else result += `${indent}${params['name']}\n${this.dump(params['value'], deep + 1)}`
        } else result = `${params}`
        return result
    }

    parser (cmd) {
        let result = []
        const codectedParams = this.codecParamsParser(cmd)

        codectedParams.forEach(param => {
            if (this.haveCodecParams(param)) {
                const paramArr = this.ffmpegSingleParamParser(param)
                result.push({
                    name: paramArr[0],
                    value: this.ffmpegParamsParser(paramArr[paramArr.length - 1], ':', -1)
                })
            } else {
                const quotedParams = this.quoteParamsParser(param)
                quotedParams.forEach(quotedParam => {
                    const t = this.ffmpegParamsParser(quotedParam, '-', 1)
                    result = [...result, ...t]
                })
                
            }
        })
        return result
    }

    format (cmd) {
        return this.dump(this.parser(cmd))
    }
}

export default new FFmpegCmdViewer()
