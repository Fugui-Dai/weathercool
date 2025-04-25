const app = getApp()

Page({
    data: {
        board: [],
        score: 0,
        highScore: 0,
        isPaused: false,
        isGameOver: false,
        selectedCell: null,
        bombCount: 3,
        colorChangerCount: 2,
        undoCount: 3,
        refreshCount: 2,
        moveHistory: [],
        selectedTool: null  // 新增：当前选中的道具
    },

    onLoad() {
        this.initGame()
        // 获取最高分
        const highScore = wx.getStorageSync('fiveInRowHighScore') || 0
        this.setData({ highScore })
    },

    initGame() {
        // 初始化8x8棋盘
        const board = Array(64).fill().map(() => ({
            type: 'empty',
            selected: false
        }))
        
        // 随机生成初始球
        this.generateInitialBalls(board)
        
        this.setData({ 
            board, 
            score: 0, 
            isGameOver: false,
            selectedCell: null,
            bombCount: 3,
            colorChangerCount: 2,
            undoCount: 3,
            refreshCount: 2,
            moveHistory: [],
            selectedTool: null
        })
    },

    generateInitialBalls(board) {
        const colors = ['red', 'blue', 'green', 'yellow', 'purple']
        for (let i = 0; i < 5; i++) {
            const emptyCells = board.map((cell, index) => ({cell, index}))
                                  .filter(({cell}) => cell.type === 'empty')
            if (emptyCells.length === 0) break
            
            const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)]
            board[randomCell.index].type = colors[Math.floor(Math.random() * colors.length)]
        }
    },

    onCellTap(e) {
        if (this.data.isPaused || this.data.isGameOver) return
        
        const index = e.currentTarget.dataset.index
        const cell = this.data.board[index]
        
        // 如果有道具被选中，优先处理道具使用
        if (this.data.selectedTool) {
            switch (this.data.selectedTool) {
                case 'bomb':
                    this.useBomb(index)
                    break
                case 'colorChanger':
                    this.useColorChanger(index)
                    break
            }
            return
        }
        
        if (this.data.selectedCell === null) {
            // 选择球
            if (cell.type !== 'empty') {
                const board = [...this.data.board]
                board[index].selected = true
                this.setData({
                    board,
                    selectedCell: index
                })
            }
        } else {
            // 移动球
            if (this.data.selectedCell === index) {
                // 取消选择
                const board = [...this.data.board]
                board[index].selected = false
                this.setData({
                    board,
                    selectedCell: null
                })
            } else if (cell.type === 'empty') {
                // 检查是否有路径
                if (this.hasPath(this.data.selectedCell, index)) {
                    this.moveBall(this.data.selectedCell, index)
                }
            }
        }
    },

    hasPath(startIndex, endIndex) {
        const visited = new Set()
        const queue = [[startIndex]]
        
        while (queue.length > 0) {
            const path = queue.shift()
            const current = path[path.length - 1]
            
            if (current === endIndex) return true
            
            const row = Math.floor(current / 8)
            const col = current % 8
            const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]]
            
            for (const [dr, dc] of directions) {
                const newRow = row + dr
                const newCol = col + dc
                const newIndex = newRow * 8 + newCol
                
                if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8 &&
                    !visited.has(newIndex) && this.data.board[newIndex].type === 'empty') {
                    visited.add(newIndex)
                    queue.push([...path, newIndex])
                }
            }
        }
        
        return false
    },

    moveBall(fromIndex, toIndex) {
        const board = [...this.data.board]
        const ballType = board[fromIndex].type
        
        // 记录移动历史
        this.data.moveHistory.push({
            board: JSON.parse(JSON.stringify(board)),
            score: this.data.score
        })
        
        // 移动球
        board[fromIndex] = { type: 'empty', selected: false }
        board[toIndex] = { type: ballType, selected: false }
        
        this.setData({
            board,
            selectedCell: null
        })
        
        // 检查消除
        const lines = this.checkLines(toIndex)
        if (lines.length > 0) {
            this.removeLines(lines)
        } else {
            // 没有消除，生成新球
            this.generateNewBalls()
        }
    },

    checkLines(index) {
        const lines = []
        const row = Math.floor(index / 8)
        const col = index % 8
        const type = this.data.board[index].type
        const directions = [
            [0, 1],  // 水平
            [1, 0],  // 垂直
            [1, 1],  // 对角线
            [1, -1]  // 反对角线
        ]
        
        for (const [dr, dc] of directions) {
            let line = [index]
            // 向一个方向查找
            for (let r = row - dr, c = col - dc; r >= 0 && c >= 0 && c < 8; r -= dr, c -= dc) {
                const idx = r * 8 + c
                if (this.data.board[idx].type === type) {
                    line.unshift(idx)
                } else break
            }
            // 向相反方向查找
            for (let r = row + dr, c = col + dc; r < 8 && c >= 0 && c < 8; r += dr, c += dc) {
                const idx = r * 8 + c
                if (this.data.board[idx].type === type) {
                    line.push(idx)
                } else break
            }
            if (line.length >= 5) lines.push(line)
        }
        
        return lines
    },

    removeLines(lines) {
        const board = [...this.data.board]
        const removedCells = new Set()
        
        // 计算得分
        let score = this.data.score
        lines.forEach(line => {
            score += 10 + (line.length - 5) * 5
            line.forEach(index => removedCells.add(index))
        })
        
        // 移除球
        removedCells.forEach(index => {
            board[index] = { type: 'empty', selected: false }
        })
        
        // 更新最高分
        const highScore = Math.max(score, this.data.highScore)
        if (highScore > this.data.highScore) {
            wx.setStorageSync('fiveInRowHighScore', highScore)
        }
        
        this.setData({ board, score, highScore })
        
        // 检查游戏是否结束
        if (this.isBoardFull()) {
            this.setData({ isGameOver: true })
        }
    },

    generateNewBalls() {
        const board = [...this.data.board]
        const emptyCells = board.map((cell, index) => ({cell, index}))
                              .filter(({cell}) => cell.type === 'empty')
        
        if (emptyCells.length < 3) {
            this.setData({ isGameOver: true })
            return
        }
        
        const colors = ['red', 'blue', 'green', 'yellow', 'purple']
        for (let i = 0; i < 3; i++) {
            if (emptyCells.length === 0) break
            
            const randomIndex = Math.floor(Math.random() * emptyCells.length)
            const cellInfo = emptyCells.splice(randomIndex, 1)[0]
            board[cellInfo.index].type = colors[Math.floor(Math.random() * colors.length)]
        }
        
        this.setData({ board })
        
        // 检查是否还有可用移动
        if (!this.hasValidMoves()) {
            this.setData({ isGameOver: true })
        }
    },

    isBoardFull() {
        return !this.data.board.some(cell => cell.type === 'empty')
    },

    hasValidMoves() {
        const board = this.data.board
        for (let i = 0; i < 64; i++) {
            if (board[i].type === 'empty') {
                for (let j = 0; j < 64; j++) {
                    if (board[j].type !== 'empty' && this.hasPath(j, i)) {
                        return true
                    }
                }
            }
        }
        return false
    },

    togglePause() {
        this.setData({ isPaused: !this.data.isPaused })
    },

    selectTool(e) {
        const tool = e.currentTarget.dataset.tool
        // 如果已经选中了这个道具，则取消选中
        if (this.data.selectedTool === tool) {
            this.setData({ selectedTool: null })
            return
        }
        
        // 检查道具数量
        let canSelect = false
        switch (tool) {
            case 'bomb':
                canSelect = this.data.bombCount > 0
                break
            case 'colorChanger':
                canSelect = this.data.colorChangerCount > 0
                break
        }
        
        if (canSelect) {
            this.setData({ 
                selectedTool: tool,
                selectedCell: null  // 取消已选中的球
            })
            
            // 取消所有球的选中状态
            const board = [...this.data.board]
            board.forEach(cell => cell.selected = false)
            this.setData({ board })
        }
    },

    useBomb(index) {
        if (this.data.bombCount <= 0 || this.data.isPaused || this.data.isGameOver) return
        
        const board = [...this.data.board]
        if (board[index].type === 'empty') {
            this.setData({ selectedTool: null })
            return
        }
        
        const row = Math.floor(index / 8)
        const col = index % 8
        
        // 清除3x3范围内的球
        for (let r = Math.max(0, row - 1); r <= Math.min(7, row + 1); r++) {
            for (let c = Math.max(0, col - 1); c <= Math.min(7, col + 1); c++) {
                const idx = r * 8 + c
                if (board[idx].type !== 'empty') {
                    board[idx] = { type: 'empty', selected: false }
                }
            }
        }
        
        this.setData({
            board,
            bombCount: this.data.bombCount - 1,
            selectedTool: null
        })
        
        // 生成新球
        this.generateNewBalls()
    },

    useColorChanger(index) {
        if (this.data.colorChangerCount <= 0 || this.data.isPaused || this.data.isGameOver) return
        
        const board = [...this.data.board]
        if (board[index].type === 'empty') {
            this.setData({ selectedTool: null })
            return
        }
        
        const colors = ['red', 'blue', 'green', 'yellow', 'purple']
        const currentColor = board[index].type
        const availableColors = colors.filter(c => c !== currentColor)
        
        board[index].type = availableColors[Math.floor(Math.random() * availableColors.length)]
        
        this.setData({
            board,
            colorChangerCount: this.data.colorChangerCount - 1,
            selectedTool: null
        })
        
        // 检查是否形成消除
        const lines = this.checkLines(index)
        if (lines.length > 0) {
            this.removeLines(lines)
        } else {
            // 没有消除，生成新球
            this.generateNewBalls()
        }
    },

    undo() {
        if (this.data.undoCount <= 0 || this.data.moveHistory.length === 0) return
        
        const lastMove = this.data.moveHistory.pop()
        this.setData({
            board: lastMove.board,
            score: lastMove.score,
            selectedCell: null,
            undoCount: this.data.undoCount - 1
        })
    },

    refresh() {
        if (this.data.refreshCount <= 0) return
        
        const board = [...this.data.board]
        const nonEmptyCells = board.map((cell, index) => ({cell, index}))
                                 .filter(({cell}) => cell.type !== 'empty')
        
        // 随机交换非空格子的颜色
        for (let i = nonEmptyCells.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            const temp = board[nonEmptyCells[i].index].type
            board[nonEmptyCells[i].index].type = board[nonEmptyCells[j].index].type
            board[nonEmptyCells[j].index].type = temp
        }
        
        this.setData({
            board,
            refreshCount: this.data.refreshCount - 1,
            selectedCell: null
        })
    },

    restartGame() {
        this.initGame()
    },

    handleBack() {
        wx.navigateBack()
    }
}) 